import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { getRecentRunsForContext } from "@/lib/runs-server";

const MODEL = "llama-3.3-70b-versatile";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GROQ_API_KEY fehlt in .env.local" },
        { status: 500 }
      );
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Nachrichten fehlen" },
        { status: 400 }
      );
    }

    if (messages[0].role !== "user") {
      return Response.json(
        { error: "Erste Nachricht muss vom Nutzer sein" },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return Response.json(
        { error: "Letzte Nachricht muss vom Nutzer sein" },
        { status: 400 }
      );
    }

    const runs = await getRecentRunsForContext(supabase, user.id);
    const systemInstruction = buildSystemPrompt(runs);

    const groqMessages = [
      { role: "system", content: systemInstruction },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: groqMessages,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      return Response.json(
        { error: "Keine Antwort von der KI erhalten" },
        { status: 500 }
      );
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: error.message || "Fehler bei der KI-Anfrage" },
      { status: 500 }
    );
  }
}
