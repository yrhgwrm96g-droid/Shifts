import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";
import { notify } from "@/lib/notify";

const toMin = (t) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
const toTime = (m) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}:00`;
};


const fmtShift = (s) => {
  const d = new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${d} ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`;
};
async function transferGiveaway(reqRow, shift, takerId) {
  const portion = reqRow.portion || "full";
  if (portion === "full") {
    await db.from("shifts").update({ user_id: takerId, status: "swapped" }).eq("id", shift.id);
    return;
  }
  const start = toMin(shift.start_time);
  let end = toMin(shift.end_time);
  if (end <= start) end += 1440;
  const mid = portion === "first4" ? start + 240 : end - 240;
  const takerStart = portion === "first4" ? start : mid;
  const takerEnd = portion === "first4" ? mid : end;
  const ownerStart = portion === "first4" ? mid : start;
  const ownerEnd = portion === "first4" ? end : mid;
  await db.from("shifts").update({
    start_time: toTime(ownerStart), end_time: toTime(ownerEnd), status: "normal",
  }).eq("id", shift.id);
  await db.from("shifts").insert({
    user_id: takerId, date: shift.date,
    start_time: toTime(takerStart), end_time: toTime(takerEnd), status: "swapped",
  });
}

// POST /api/swaps/:id
//  { action: "accept", offered_shift_id? }  giveaway: instant transfer
//                                           swap: creates a proposal (awaiting_confirm)
//  { action: "confirm" }                    poster confirms a swap proposal -> exchange happens
//  { action: "decline_proposal" }           poster declines -> offer returns to pending
export async function POST(req, { params }) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json();

  const { data: reqRow } = await db
    .from("swap_requests").select("*").eq("id", params.id).maybeSingle();
  if (!reqRow) return json({ error: "Offer not found" }, 404);

  const { data: shift } = await db
    .from("shifts").select("*").eq("id", reqRow.shift_id).maybeSingle();
  if (!shift) return json({ error: "Shift not found" }, 404);

  if (body.action === "accept") {
    if (reqRow.status !== "pending") return json({ error: "Offer is no longer available" }, 400);
    if (reqRow.from_user === user.id) return json({ error: "You cannot accept your own offer" }, 400);

    if (reqRow.type === "giveaway") {
      await transferGiveaway(reqRow, shift, user.id);
      await db.from("swap_requests")
        .update({ status: "accepted", to_user: user.id, resolved_at: new Date().toISOString() })
        .eq("id", reqRow.id);
      await notify(reqRow.from_user, `${user.name} took your shift ${fmtShift(shift)}. Your calendar is updated.`);
      return json({ ok: true });
    }

    // swap -> proposal, waits for poster's confirmation
    const mineId = body.offered_shift_id;
    if (!mineId) return json({ error: "Choose one of your shifts to swap" }, 400);
    const { data: mine } = await db
      .from("shifts").select("*").eq("id", mineId).maybeSingle();
    if (!mine || mine.user_id !== user.id) return json({ error: "That is not your shift" }, 400);
    if (mine.status !== "normal") return json({ error: "That shift is already offered elsewhere" }, 400);

    await db.from("swap_requests")
      .update({ status: "awaiting_confirm", to_user: user.id, offered_shift_id: mine.id })
      .eq("id", reqRow.id);
    await notify(reqRow.from_user, `${user.name} proposed a swap for your shift ${fmtShift(shift)} — open the Marketplace to confirm or decline.`);
    return json({ ok: true, proposed: true });
  }

  if (body.action === "confirm") {
    if (reqRow.status !== "awaiting_confirm") return json({ error: "Nothing to confirm" }, 400);
    if (reqRow.from_user !== user.id) return json({ error: "Only the poster can confirm" }, 403);
    const { data: theirs } = await db
      .from("shifts").select("*").eq("id", reqRow.offered_shift_id).maybeSingle();
    if (!theirs || theirs.user_id !== reqRow.to_user || theirs.status !== "normal")
      return json({ error: "The proposed shift is no longer available" }, 400);

    await db.from("shifts").update({ user_id: reqRow.to_user, status: "swapped" }).eq("id", shift.id);
    await db.from("shifts").update({ user_id: reqRow.from_user, status: "swapped" }).eq("id", theirs.id);
    await db.from("swap_requests")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", reqRow.id);
    await notify(reqRow.to_user, `${user.name} confirmed your swap. You now have ${fmtShift(shift)}; they took ${fmtShift(theirs)}.`);
    return json({ ok: true });
  }

  if (body.action === "decline_proposal") {
    if (reqRow.status !== "awaiting_confirm") return json({ error: "Nothing to decline" }, 400);
    if (reqRow.from_user !== user.id) return json({ error: "Only the poster can decline" }, 403);
    const declinedProposer = reqRow.to_user;
    await db.from("swap_requests")
      .update({ status: "pending", to_user: null, offered_shift_id: null })
      .eq("id", reqRow.id);
    await notify(declinedProposer, `${user.name} declined your swap proposal for ${fmtShift(shift)}.`);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
}
