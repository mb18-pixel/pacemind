import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function requireCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return; // optional
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  return null;
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || "mailto:support@performanceprotokoll.de";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY fehlen in env");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function weekRangeIso(today = new Date()) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  // JS: 0=So ... 6=Sa → 0=Mo ... 6=So
  const daysSinceMon = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - daysSinceMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x) => x.toISOString().split("T")[0];
  return { startIso: iso(start), endIso: iso(end) };
}

export async function GET(request) {
  try {
    const authResp = requireCron(request);
    if (authResp) return authResp;

    configureWebPush();
    const supabase = createAdminClient();
    const { startIso, endIso } = weekRangeIso();

    // Nur Nutzer mit Subscription benachrichtigen
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription");
    if (subsErr) throw subsErr;

    const byUser = new Map();
    for (const row of subs || []) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push(row.subscription);
    }

    let sent = 0;
    let users = 0;

    for (const [userId, userSubs] of byUser.entries()) {
      users++;
      const { data: planRows, error: planErr } = await supabase
        .from("training_plan")
        .select("trainingstyp, distanz_km, status")
        .eq("user_id", userId)
        .gte("datum", startIso)
        .lte("datum", endIso);
      if (planErr) continue;

      const entries = (planRows || []).filter(
        (e) => e.trainingstyp && e.trainingstyp !== "pause" && e.status !== "uebersprungen"
      );
      const einheiten = entries.length;
      const km = entries.reduce((acc, e) => acc + (Number(e.distanz_km) || 0), 0);

      const payload = JSON.stringify({
        title: "Dein Wochenplan ist bereit 💪",
        body: `Diese Woche: ${einheiten} Einheiten, ${Math.round(km * 10) / 10} km geplant. Tap to see.`,
        url: "/laeufe",
      });

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch {
          // ignorieren – Cleanup läuft über /api/push/send
        }
      }
    }

    return Response.json({ success: true, users, sent });
  } catch (error) {
    console.error("weekly-plan cron error:", error);
    return Response.json(
      { error: error.message || "Cron fehlgeschlagen" },
      { status: 500 }
    );
  }
}
