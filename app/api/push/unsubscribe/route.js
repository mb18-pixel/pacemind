import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
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

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return Response.json(
      { error: error.message || "Subscription konnte nicht gelöscht werden" },
      { status: 500 }
    );
  }
}

