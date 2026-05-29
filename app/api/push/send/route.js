import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function requireAdmin(request) {
  const secret = process.env.PUSH_ADMIN_SECRET;
  if (!secret) return; // optional
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    const err = new Error("Nicht autorisiert");
    err.status = 401;
    throw err;
  }
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@performanceprotokoll.de";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY fehlen in env");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(request) {
  try {
    requireAdmin(request);
    configureWebPush();

    const body = await request.json();
    const { userId, title, body: msgBody, url } = body || {};
    const payload = JSON.stringify({
      title: title || "PaceMind",
      body: msgBody || "Dein Coach hat eine Nachricht.",
      url: url || "/chat",
    });

    const supabase = createAdminClient();
    let q = supabase.from("push_subscriptions").select("id, user_id, subscription");
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw error;

    const subs = data || [];
    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (e) {
        failed++;
        // Ungültige Subscription entfernen (z. B. 410 Gone)
        const statusCode = e?.statusCode || e?.status || null;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        }
      }
    }

    return Response.json({ success: true, total: subs.length, sent, failed, removed });
  } catch (error) {
    console.error("Push send error:", error);
    return Response.json(
      { error: error.message || "Push konnte nicht gesendet werden" },
      { status: error.status || 500 }
    );
  }
}

