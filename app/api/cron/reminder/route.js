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

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

const reminderSprueche = [
  {
    titel: "Dein Coach vermisst dich 🏃",
    body: "Du hast seit {tage} Tagen nicht trainiert. Deine Laufschuhe fangen an, sich verlassen zu fühlen.",
  },
  {
    titel: "Notfall-Erinnerung 🚨",
    body: "Es ist offiziell: dein Sofa gewinnt gerade gegen deinen Trainingsplan.",
  },
  {
    titel: "Kurze Frage 🤔",
    body: "Existieren deine Laufschuhe noch oder hast du sie verkauft?",
  },
  {
    titel: "Statusupdate 📊",
    body: "{tage} Tage ohne Lauf. Dein VDOT-Wert schreibt gerade Beschwerdebriefe.",
  },
  {
    titel: "Realitätscheck ⏰",
    body: "Dein Trainingsplan und du habt euch entfremdet. Zeit für Paartherapie?",
  },
  {
    titel: "Coach-Kommentar 💭",
    body: "Ich erstelle hier wissenschaftlich fundierte Pläne und du schaust Netflix. Wir müssen reden.",
  },
];

function getRandomReminder(tageSeitLetztemLauf) {
  const zufall =
    reminderSprueche[Math.floor(Math.random() * reminderSprueche.length)];
  return {
    titel: zufall.titel,
    body: zufall.body.replace("{tage}", String(tageSeitLetztemLauf)),
  };
}

export async function GET(request) {
  try {
    const authResp = requireCron(request);
    if (authResp) return authResp;

    configureWebPush();
    const supabase = createAdminClient();

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription");
    if (subsErr) throw subsErr;

    const byUser = new Map();
    for (const row of subs || []) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push(row.subscription);
    }

    const today = new Date();
    let sent = 0;
    let users = 0;

    for (const [userId, userSubs] of byUser.entries()) {
      users++;
      const { data: lastRun, error: runErr } = await supabase
        .from("runs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (runErr) continue;

      if (!lastRun?.created_at) continue;
      const diffDays = daysBetween(lastRun.created_at, today);
      if (diffDays < 3) continue;

      const reminder = getRandomReminder(diffDays);

      const payload = JSON.stringify({
        title: reminder.titel,
        body: reminder.body,
        url: "/chat",
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
    console.error("reminder cron error:", error);
    return Response.json(
      { error: error.message || "Cron fehlgeschlagen" },
      { status: 500 }
    );
  }
}

