import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import {
  executeCoachAction,
  extractJsonFromReply,
} from "@/lib/chat-actions";
import { buildContextPayload, buildSystemPrompt } from "@/lib/prompt";
import { getProfileForUser, getProfileWeatherContext } from "@/lib/profile-server";
import { getRecentRunsForContext } from "@/lib/runs-server";
import {
  getTrainingPlan,
  getTrainingSlots,
} from "@/lib/training-server";

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
      return Response.json({ error: "Nachrichten fehlen" }, { status: 400 });
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

    const simulatedTodayIso =
      process.env.NODE_ENV === "development"
        ? request.headers.get("x-simulated-date")
        : null;

    const [runs, profile, trainingSlots] = await Promise.all([
      getRecentRunsForContext(supabase, user.id),
      getProfileForUser(supabase, user.id).catch(() => null),
      getTrainingSlots(supabase, user.id).catch(() => []),
    ]);

    // TrainingPlan für Prompt-Abschnitt ggf. mit simuliertem Datum laden (nur Dev)
    let trainingPlan = [];
    if (simulatedTodayIso) {
      const startIso = simulatedTodayIso;
      const end = new Date(simulatedTodayIso);
      end.setDate(end.getDate() + 14);
      const endIso = end.toISOString().split("T")[0];
      const { data } = await supabase
        .from("training_plan")
        .select("*")
        .eq("user_id", user.id)
        .gte("datum", startIso)
        .lte("datum", endIso)
        .order("datum", { ascending: true });
      trainingPlan = data || [];
    } else {
      trainingPlan = await getTrainingPlan(supabase, user.id, 14).catch(() => []);
    }

    const weatherContext = profile
      ? await getProfileWeatherContext(profile)
      : null;

    const extraContextPayload = await buildContextPayload(user.id, supabase, {
      simulatedTodayIso,
    }).catch(
      (e) => {
        console.error("Context payload error:", e);
        return "";
      }
    );

    const systemInstruction = buildSystemPrompt(
      runs,
      profile,
      weatherContext,
      trainingPlan,
      trainingSlots,
      extraContextPayload
    );

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
      temperature: 0.35,
    });

    const reply = completion.choices[0]?.message?.content;
    if (!reply) {
      return Response.json(
        { error: "Keine Antwort von der KI erhalten" },
        { status: 500 }
      );
    }

    let textReply = reply;
    let actionResult = null;

    const parsed = extractJsonFromReply(reply);
    if (parsed?.action && parsed.data !== undefined) {
      textReply = parsed.text || reply;
      actionResult = await executeCoachAction(
        supabase,
        user.id,
        parsed.action,
        parsed.data
      );
    }

    const planUpdated =
      actionResult?.type === "plan_day_updated" ||
      actionResult?.type === "plan_replanned" ||
      actionResult?.type === "slots_updated" ||
      actionResult?.type === "slot_updated";

    return Response.json({
      reply: textReply,
      action: actionResult,
      planUpdated,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: error.message || "Fehler bei der KI-Anfrage" },
      { status: 500 }
    );
  }
}
