import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET -> my latest notifications + unread count
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data, error } = await db
    .from("notifications")
    .select("id, message, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return json({ error: error.message }, 500);
  const unread = (data || []).filter((n) => !n.read).length;
  return json({ notifications: data, unread });
}

// POST -> mark all my notifications as read
export async function POST() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  await db.from("notifications").update({ read: true })
    .eq("user_id", user.id).eq("read", false);
  return json({ ok: true });
}
