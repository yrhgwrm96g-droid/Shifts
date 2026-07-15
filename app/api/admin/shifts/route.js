import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET -> all upcoming shifts
export async function GET() {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { data, error } = await db
    .from("shifts")
    .select("id, date, start_time, end_time, status, user_id, users(name, username)")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date").order("start_time");
  if (error) return json({ error: error.message }, 500);
  return json({ shifts: data });
}

// POST { user_id, date, start_time, end_time, pattern, repeat_until }
// pattern: "single" -> one shift on `date`
//          "weekly" -> same weekday every week until repeat_until
//          "rota33" -> 3 days on / 3 days off; `date` = FIRST day of a working block
export async function POST(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { user_id, date, start_time, end_time, pattern = "single", repeat_until } = await req.json();
  if (!user_id || !date || !start_time || !end_time)
    return json({ error: "user, date, start and end time are required" }, 400);
  if (pattern !== "single" && !repeat_until)
    return json({ error: "repeat until date is required for repeating patterns" }, 400);

  const DAY = 24 * 3600 * 1000;
  const rows = [];
  const first = new Date(date + "T00:00:00Z");
  const limit = pattern === "single" ? first : new Date(repeat_until + "T00:00:00Z");

  if (pattern === "rota33") {
    // 6-day cycle: days 0,1,2 working; 3,4,5 off
    for (let d = new Date(first); d <= limit; d = new Date(d.getTime() + DAY)) {
      const dayIndex = Math.round((d - first) / DAY) % 6;
      if (dayIndex <= 2) rows.push({ user_id, date: d.toISOString().slice(0, 10), start_time, end_time });
    }
  } else {
    const step = pattern === "weekly" ? 7 * DAY : DAY + limit - first; // single: loop once
    for (let d = new Date(first); d <= limit; d = new Date(d.getTime() + step)) {
      rows.push({ user_id, date: d.toISOString().slice(0, 10), start_time, end_time });
    }
  }

  if (rows.length === 0) return json({ error: "No shifts generated - check the dates" }, 400);
  if (rows.length > 200) return json({ error: "Too many shifts at once (max 200) - shorten the date range" }, 400);

  const { error } = await db.from("shifts").insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, created: rows.length });
}

// DELETE { id } -> delete one shift
// DELETE { user_id, from, to } -> delete a user's shifts in a date range
export async function DELETE(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const body = await req.json();
  if (body.id) {
    const { error } = await db.from("shifts").delete().eq("id", body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  if (body.user_id && body.from && body.to) {
    const { error } = await db.from("shifts").delete()
      .eq("user_id", body.user_id).gte("date", body.from).lte("date", body.to);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }
  return json({ error: "Provide id, or user_id + from + to" }, 400);
}
