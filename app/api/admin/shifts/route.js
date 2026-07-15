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

// POST { user_id, date, start_time, end_time, repeat_until? }
// If repeat_until is set, creates the same shift every 7 days up to that date.
export async function POST(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { user_id, date, start_time, end_time, repeat_until } = await req.json();
  if (!user_id || !date || !start_time || !end_time)
    return json({ error: "user, date, start and end time are required" }, 400);

  const rows = [];
  let d = new Date(date + "T00:00:00Z");
  const limit = repeat_until ? new Date(repeat_until + "T00:00:00Z") : d;
  while (d <= limit) {
    rows.push({ user_id, date: d.toISOString().slice(0, 10), start_time, end_time });
    d = new Date(d.getTime() + 7 * 24 * 3600 * 1000);
  }
  const { error } = await db.from("shifts").insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, created: rows.length });
}

// DELETE { id } -> delete a shift
export async function DELETE(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { id } = await req.json();
  const { error } = await db.from("shifts").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
