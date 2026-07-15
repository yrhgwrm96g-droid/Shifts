import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// Time helpers: minutes since midnight, wrapping around 24h (for night shifts like 23:00-07:00)
const toMin = (t) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
const toTime = (m) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}:00`;
};

// POST /api/swaps/:id { action: "accept", offered_shift_id? }
export async function POST(req, { params }) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json();
  if (body.action !== "accept") return json({ error: "Unknown action" }, 400);

  const { data: reqRow } = await db
    .from("swap_requests").select("*").eq("id", params.id).maybeSingle();
  if (!reqRow || reqRow.status !== "pending") return json({ error: "Offer is no longer available" }, 400);
  if (reqRow.from_user === user.id) return json({ error: "You cannot accept your own offer" }, 400);

  const { data: shift } = await db
    .from("shifts").select("*").eq("id", reqRow.shift_id).maybeSingle();
  if (!shift) return json({ error: "Shift not found" }, 404);

  const portion = reqRow.portion || "full";

  if (reqRow.type === "giveaway") {
    if (portion === "full") {
      await db.from("shifts")
        .update({ user_id: user.id, status: "swapped" })
        .eq("id", shift.id);
    } else {
      // Split the shift: 4 hours to the taker, the rest stays with the owner.
      const start = toMin(shift.start_time);
      let end = toMin(shift.end_time);
      if (end <= start) end += 1440; // crosses midnight
      const mid = portion === "first4" ? start + 240 : end - 240;

      const takerStart = portion === "first4" ? start : mid;
      const takerEnd = portion === "first4" ? mid : end;
      const ownerStart = portion === "first4" ? mid : start;
      const ownerEnd = portion === "first4" ? end : mid;

      // Owner keeps the remaining part (update in place)
      await db.from("shifts").update({
        start_time: toTime(ownerStart), end_time: toTime(ownerEnd), status: "normal",
      }).eq("id", shift.id);
      // Taker gets a new shift row for their 4 hours
      await db.from("shifts").insert({
        user_id: user.id, date: shift.date,
        start_time: toTime(takerStart), end_time: toTime(takerEnd), status: "swapped",
      });
    }
  } else {
    // swap: validate the shift offered in return
    const mineId = body.offered_shift_id;
    if (!mineId) return json({ error: "Choose one of your shifts to swap" }, 400);
    const { data: mine } = await db
      .from("shifts").select("*").eq("id", mineId).maybeSingle();
    if (!mine || mine.user_id !== user.id) return json({ error: "That is not your shift" }, 400);
    if (mine.status !== "normal") return json({ error: "That shift is already offered elsewhere" }, 400);

    await db.from("shifts").update({ user_id: user.id, status: "swapped" }).eq("id", shift.id);
    await db.from("shifts").update({ user_id: reqRow.from_user, status: "swapped" }).eq("id", mine.id);
    await db.from("swap_requests")
      .update({ offered_shift_id: mine.id }).eq("id", reqRow.id);
  }

  await db.from("swap_requests")
    .update({ status: "accepted", to_user: user.id, resolved_at: new Date().toISOString() })
    .eq("id", reqRow.id);

  return json({ ok: true });
}
