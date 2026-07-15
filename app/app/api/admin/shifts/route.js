import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";
import { notify } from "@/lib/notify";

// Admins AND Senior Service Managers can manage shifts
async function requireStaff() {
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
  if (!(await requireStaff())) return json({ error: "Staff only" }, 403);
  const { data, error } = await db
    .from("shifts")
    .select("id, date, start_time, end_time, status, user_id, users(name, username)")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date").order("start_time");
  if (error) return json({ error: error.message }, 500);
  return json({ shifts: data });
}

// POST { user_ids, date, start_time, end_time, pattern, repeat_until }
export async function POST(req) {
  const staff = await requireStaff();
  if (!staff) return json({ error: "Staff only" }, 403);
  const body = await req.json();
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

  for (const uid of userIds) {
    if (uid !== staff.id)
      await notify(uid, `${staff.name} added ${dates.length} shift(s) to your schedule.`);
  }
  return json({ ok: true, created: rows.length });
}

// PATCH { id, user_id }      -> reassign a shift to another member
// PATCH { swap: [idA, idB] } -> exchange the owners of two shifts
export async function PATCH(req) {
  const staff = await requireStaff();
  if (!staff) return json({ error: "Staff only" }, 403);
  const body = await req.json();

  if (body.id && body.user_id) {
    const { data: shift } = await db.from("shifts").select("*").eq("id", body.id).maybeSingle();
    if (!shift) return json({ error: "Shift not found" }, 404);
    if (shift.user_id === body.user_id) return json({ error: "Shift already belongs to that member" }, 400);

    // cancel any open offers on this shift, then move it
    await db.from("swap_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("shift_id", shift.id).in("status", ["pending", "awaiting_confirm"]);
    const { error } = await db.from("shifts")
      .update({ user_id: body.user_id, status: "normal" }).eq("id", shift.id);
    if (error) return json({ error: error.message }, 500);

    await notify(shift.user_id, `${staff.name} moved your shift ${fmtShift(shift)} to another member.`);
    await notify(body.user_id, `${staff.name} assigned you a shift: ${fmtShift(shift)}.`);
    return json({ ok: true });
  }

  if (Array.isArray(body.swap) && body.swap.length === 2) {
    const [aId, bId] = body.swap;
    const { data: a } = await db.from("shifts").select("*").eq("id", aId).maybeSingle();
    const { data: b } = await db.from("shifts").select("*").eq("id", bId).maybeSingle();
    if (!a || !b) return json({ error: "Shift not found" }, 404);
    if (a.user_id === b.user_id) return json({ error: "Both shifts belong to the same member" }, 400);

    for (const s of [a, b]) {
      await db.from("swap_requests")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("shift_id", s.id).in("status", ["pending", "awaiting_confirm"]);
    }
    await db.from("shifts").update({ user_id: b.user_id, status: "normal" }).eq("id", a.id);
    await db.from("shifts").update({ user_id: a.user_id, status: "normal" }).eq("id", b.id);

    await notify(a.user_id, `${staff.name} swapped your shift ${fmtShift(a)} for ${fmtShift(b)} (by request).`);
    await notify(b.user_id, `${staff.name} swapped your shift ${fmtShift(b)} for ${fmtShift(a)} (by request).`);
    return json({ ok: true });
  }

  return json({ error: "Provide { id, user_id } or { swap: [idA, idB] }" }, 400);
}

// DELETE { id } or { user_id, from, to }
export async function DELETE(req) {
  const staff = await requireStaff();
  if (!staff) return json({ error: "Staff only" }, 403);
  const body = await req.json();
  if (body.id) {
    const { data: shift } = await db.from("shifts").select("*").eq("id", body.id).maybeSingle();
    const { error } = await db.from("shifts").delete().eq("id", body.id);
    if (error) return json({ error: error.message }, 500);
    if (shift && shift.user_id !== staff.id)
      await notify(shift.user_id, `${staff.name} removed your shift ${fmtShift(shift)}.`);
    return json({ ok: true });
  }
  if (body.user_id && body.from && body.to) {
    const { error } = await db.from("shifts").delete()
      .eq("user_id", body.user_id).gte("date", body.from).lte("date", body.to);
    if (error) return json({ error: error.message }, 500);
    await notify(body.user_id, `${staff.name} cleared your shifts from ${body.from} to ${body.to}.`);
    return json({ ok: true });
  }
  return json({ error: "Provide id, or user_id + from + to" }, 400);
}
