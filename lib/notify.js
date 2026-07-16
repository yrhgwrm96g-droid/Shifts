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

async function sendPushes(userId, message) {
  try {
    if (!initVapid()) return;
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
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      })
    );
  } catch {}
}

// In-app notification (awaited, fast) + phone push (runs AFTER the response is sent,
// so it adds zero latency to the user's action). Never throws.
export async function notify(userId, message) {
  if (!userId) return;
  try {
    await db.from("notifications").insert({ user_id: userId, message });
  } catch {}

  const task = sendPushes(userId, message);
  try {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(task);           // Vercel keeps the function alive in the background
  } catch {
    await task;                // local dev / other hosts: just await
  }
}
