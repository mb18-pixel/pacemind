import { createClient } from "@/lib/supabase/server";
import { deleteRunForUser } from "@/lib/runs-server";

export async function DELETE(_request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    const { id } = await params;
    await deleteRunForUser(supabase, user.id, id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Runs DELETE error:", error);
    return Response.json(
      { error: error.message || "Lauf konnte nicht gelöscht werden" },
      { status: 500 }
    );
  }
}
