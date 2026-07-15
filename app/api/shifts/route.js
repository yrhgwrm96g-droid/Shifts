import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET /api/shifts?from=YYYY-MM-DD&to=YYYY-MM-DD        -> my shifts in range
// GET /api/shifts?from=...&to=...&all=1                -> everyone's shifts in range
// Without from/to: upcoming shifts from today.
export async function GET(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const p = new URL(req.url).searchParams;
  const all = p.get("all") === "1";
  const from = p.get("from") || new Date().toISOString().slice(0, 10);
  const to = p.get("to");

  let q = db
    .from("shifts")
    .select("id, date, start_time, end_time, status, user_id, users(name, username)")
    .gte("date", from)
    .order("date")
    .order("start_time");
  if (to) q = q.lte("date", to);
  if (!all) q = q.eq("user_id", user.id);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ shifts: data, me: user.id });
}
