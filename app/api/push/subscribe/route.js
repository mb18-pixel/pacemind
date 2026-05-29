import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return Response.json({ error: authError.message }, { status: 401 });
    }
    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const body = await request.json();
    const subscription = body?.subscription;
    if (!subscription) {
      return Response.json(
        { error: "subscription fehlt im Request Body" },
        { status: 400 }
      );
    }

    // Ohne unique-Constraint: immer erst alte Subscriptions löschen, dann neue speichern
    const { error: delErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);
    if (delErr) throw delErr;

    const { data, error } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: user.id,
        subscription,
      })
      .select()
      .single();
    if (error) throw error;

    return Response.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return Response.json(
      { error: error.message || "Subscription konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }
}

