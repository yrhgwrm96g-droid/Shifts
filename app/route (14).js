import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";
import { notify } from "@/lib/notify";

// Admins AND Senior Service Managers can manage shifts.
async function requireManager() {
  const user = await currentUser();
  if (!user || !["admin", "manager"].includes(user.role)) return null;
  return user;
}

const fmtShift = (s) => {
  const d = new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${d} ${s.start_time.slice(0, 5)}\u2013${s.end_time.slice(0, 5)}`;
};

// GET -> all upcoming shifts
export async function GET() {
  if (!(await requireManager())) return json({ error: "Managers only" }, 403);
  const { data, error } = await db
    .from("shifts")
    .select("id, date, start_time, end_time, status, user_id, users(name, username)")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date").order("start_time");
  if (error) return json({ error: error.message }, 500);
  return json({ shifts: data });
}

// POST (create):   { user_ids, date, start_time, end_time, pattern, repeat_until }
// POST (manual swap): { swap_two: [shiftIdA, shiftIdB] }
export async function POST(req) {
  const actor = await requireManager();
  if (!actor) return json({ error: "Managers only" }, 403);
  const body = await req.json();

  // ---- Manual swap of two existing shifts (real-life request) ----
  if (body.swap_two) {
    const [idA, idB] = body.swap_two;
    if (!idA || !idB || idA === idB) return json({ error: "Pick two different shifts" }, 400);
    const { data: a } = await db.from("shifts").select("*").eq("id", idA).maybeSingle();
    const { data: b } = await db.from("shifts").select("*").eq("id", idB).maybeSingle();
    if (!a || !b) return json({ error: "Shift not found" }, 404);
    if (a.user_id === b.user_id) return json({ error: "Both shifts belong to the same person" }, 400);

    await db.from("shifts").update({ user_id: b.user_id, status: "swapped" }).eq("id", a.id);
    await db.from("shifts").update({ user_id: a.user_id, status: "swapped" }).eq("id", b.id);
    // Audit record so it appears in Activity + Approvals
    await db.from("swap_requests").insert({
      shift_id: a.id, from_user: a.user_id, to_user: b.user_id,
      type: "swap", offered_shift_id: b.id, status: "accepted",
      note: `Manual swap by ${actor.name}`, resolved_at: new Date().toISOString(),
    });
    await notify(a.user_id, `${actor.name} swapped your shift ${fmtShift(a)} with ${fmtShift(b)}. Check your calendar.`);
    await notify(b.user_id, `${actor.name} swapped your shift ${fmtShift(b)} with ${fmtShift(a)}. Check your calendar.`);
    return json({ ok: true });
  }

  // ---- Create shifts ----
  const { date, start_time, end_time, pattern = "single", repeat_until } = body;
  const userIds = body.user_ids || (body.user_id ? [body.user_id] : []);
  if (userIds.length === 0 || !date || !start_time || !end_time)
    return json({ error: "user(s), date, start and end time are required" }, 400);
  if (pattern !== "single" && !repeat_until)
    return json({ error: "repeat until date is required for repeating patterns" }, 400);

  const DAY = 24 * 3600 * 1000;
  const dates = [];
  const first = new Date(date + "T00:00:00Z");
  const limit = pattern === "single" ? first : new Date(repeat_until + "T00:00:00Z");

  if (pattern === "rota33") {
    for (let d = new Date(first); d <= limit; d = new Date(d.getTime() + DAY)) {
      const dayIndex = Math.round((d - first) / DAY) % 6;
      if (dayIndex <= 2) dates.push(d.toISOString().slice(0, 10));
    }
  } else {
    const step = pattern === "weekly" ? 7 * DAY : DAY + limit - first;
    for (let d = new Date(first); d <= limit; d = new Date(d.getTime() + step)) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  const rows = [];
  for (const uid of userIds)
    for (const dt of dates)
      rows.push({ user_id: uid, date: dt, start_time, end_time });

  if (rows.length === 0) return json({ error: "No shifts generated - check the dates" }, 400);
  if (rows.length > 600) return json({ error: "Too many shifts at once (max 600) - shorten the date range" }, 400);

  const { error } = await db.from("shifts").insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, created: rows.length });
}

// PATCH { id, user_id?, date?, start_time?, end_time? } -> edit or reassign a shift
export async function PATCH(req) {
  const actor = await requireManager();
  if (!actor) return json({ error: "Managers only" }, 403);
  const { id, ...changes } = await req.json();
  if (!id) return json({ error: "Shift id required" }, 400);

  const { data: before } = await db.from("shifts").select("*").eq("id", id).maybeSingle();
  if (!before) return json({ error: "Shift not found" }, 404);

  const allowed = {};
  for (const k of ["user_id", "date", "start_time", "end_time"])
    if (changes[k]) allowed[k] = changes[k];
  if (Object.keys(allowed).length === 0) return json({ error: "Nothing to change" }, 400);

  const { error } = await db.from("shifts").update(allowed).eq("id", id);
  if (error) return json({ error: error.message }, 500);

  const after = { ...before, ...allowed };
  if (allowed.user_id && allowed.user_id !== before.user_id) {
    // Reassignment -> audit record + notify both sides
    await db.from("swap_requests").insert({
      shift_id: id, from_user: before.user_id, to_user: allowed.user_id,
      type: "giveaway", status: "accepted",
      note: `Reassigned by ${actor.name}`, resolved_at: new Date().toISOString(),
    });
    await notify(before.user_id, `${actor.name} moved your shift ${fmtShift(before)} to a colleague.`);
    await notify(allowed.user_id, `${actor.name} assigned you a shift: ${fmtShift(after)}.`);
  } else {
    await notify(before.user_id, `${actor.name} changed your shift ${fmtShift(before)} \u2192 ${fmtShift(after)}.`);
  }
  return json({ ok: true });
}

// DELETE { id } or { user_id, from, to }
export async function DELETE(req) {
  const actor = await requireManager();
  if (!actor) return json({ error: "Managers only" }, 403);
  const body = await req.json();
  if (body.id) {
    const { data: s } = await db.from("shifts").select("*").eq("id", body.id).maybeSingle();
    const { error } = await db.from("shifts").delete().eq("id", body.id);
    if (error) return json({ error: error.message }, 500);
    if (s) await notify(s.user_id, `${actor.name} removed your shift ${fmtShift(s)}.`);
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
