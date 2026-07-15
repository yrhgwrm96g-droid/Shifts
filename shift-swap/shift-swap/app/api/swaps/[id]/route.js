import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// POST /api/swaps/:id { action: "accept", offered_shift_id? }
// Giveaway: the accepting user takes over the shift.
// Swap: the accepting user gives one of their own shifts in return.
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

  if (reqRow.type === "giveaway") {
    await db.from("shifts")
      .update({ user_id: user.id, status: "swapped" })
      .eq("id", shift.id);
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
