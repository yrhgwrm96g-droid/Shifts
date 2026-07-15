import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET /api/shifts        -> my shifts (upcoming)
// GET /api/shifts?all=1  -> everyone's shifts (team schedule view)
export async function GET(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const all = new URL(req.url).searchParams.get("all") === "1";
  let q = db
    .from("shifts")
    .select("id, date, start_time, end_time, status, user_id, users(name, email)")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date")
    .order("start_time");
  if (!all) q = q.eq("user_id", user.id);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ shifts: data });
}
