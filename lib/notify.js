import webpush from "web-push";
import { db } from "./supabase";

let vapidReady = false;
function initVapid() {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:admin@shift-swap.local", pub, priv);
  vapidReady = true;
  return true;
}

// In-app notification + push to all of the user's devices. Never throws.
export async function notify(userId, message) {
  if (!userId) return;
  try {
    await db.from("notifications").insert({ user_id: userId, message });
  } catch {}

  try {
    if (!initVapid()) return; // push not configured -> in-app only
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("user_id", userId);
    if (!subs?.length) return;

    const payload = JSON.stringify({ title: "Shift Swap", body: message, url: "/schedule" });
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription, payload);
        } catch (err) {
          // 404/410 = subscription is dead (app uninstalled etc.) -> clean up
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      })
    );
  } catch {}
}
