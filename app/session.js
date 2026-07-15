import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// POST /api/shifts/:id  { action: "offer", type: "giveaway"|"swap", portion?, note? }
//   portion: "full" (default) | "first4" | "last4"  (partial only for giveaways)
// POST /api/shifts/:id  { action: "cancel_offer" }
export async function POST(req, { params }) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json();
  const { data: shift } = await db
    .from("shifts").select("*").eq("id", params.id).maybeSingle();
  if (!shift) return json({ error: "Shift not found" }, 404);
  if (shift.user_id !== user.id) return json({ error: "Not your shift" }, 403);

  if (body.action === "offer") {
    if (shift.status !== "normal") return json({ error: "Shift is already offered" }, 400);
    if (!["giveaway", "swap"].includes(body.type)) return json({ error: "Invalid type" }, 400);
    const portion = body.portion || "full";
    if (!["full", "first4", "last4"].includes(portion)) return json({ error: "Invalid portion" }, 400);
    if (portion !== "full" && body.type !== "giveaway")
      return json({ error: "Partial (4-hour) offers are only for giveaways" }, 400);
    const { error } = await db.from("swap_requests").insert({
      shift_id: shift.id, from_user: user.id, type: body.type,
      portion, note: body.note || null,
    });
    if (error) return json({ error: error.message }, 500);
    await db.from("shifts").update({ status: "offered" }).eq("id", shift.id);
    return json({ ok: true });
  }

  if (body.action === "cancel_offer") {
    await db.from("swap_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("shift_id", shift.id).in("status", ["pending", "awaiting_confirm"]);
    await db.from("shifts").update({ status: "normal" }).eq("id", shift.id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
}
