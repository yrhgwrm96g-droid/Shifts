import { db } from "./supabase";

// Fire-and-forget notification insert. Never throws.
export async function notify(userId, message) {
  if (!userId) return;
  try {
    await db.from("notifications").insert({ user_id: userId, message });
  } catch {}
}
