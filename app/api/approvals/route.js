import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";
import { notify } from "@/lib/notify";

function canApprove(user) {
  return user && (user.role === "manager" || user.role === "admin");
}

// GET -> completed deals (accepted), newest first, with MAIN-program approval state
export async function GET() {
  const user = await currentUser();
  if (!canApprove(user)) return json({ error: "Managers only" }, 403);

  const { data, error } = await db
    .from("swap_requests")
    .select(`
      id, type, portion, note, status, resolved_at, main_approved, main_approved_at,
      shift:shifts!swap_requests_shift_id_fkey(date, start_time, end_time),
      offered:shifts!swap_requests_offered_shift_id_fkey(date, start_time, end_time),
      poster:users!swap_requests_from_user_fkey(name, username),
      taker:users!swap_requests_to_user_fkey(name, username),
      approver:users!swap_requests_main_approved_by_fkey(name, username)
    `)
    .eq("status", "accepted")
    .order("resolved_at", { ascending: false })
    .limit(200);
  if (error) return json({ error: error.message }, 500);
  return json({ deals: data });
}

// POST { id, approved: true|false } -> mark/unmark as approved in the MAIN program
export async function POST(req) {
  const user = await currentUser();
  if (!canApprove(user)) return json({ error: "Managers only" }, 403);
  const { id, approved } = await req.json();
  const { data: deal } = await db
    .from("swap_requests")
    .select("from_user, to_user, shift:shifts!swap_requests_shift_id_fkey(date, start_time, end_time)")
    .eq("id", id).maybeSingle();
  const { error } = await db
    .from("swap_requests")
    .update({
      main_approved: !!approved,
      main_approved_by: approved ? user.id : null,
      main_approved_at: approved ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return json({ error: error.message }, 500);
  if (approved && deal) {
    const s = deal.shift;
    const label = s ? `${new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}` : "your deal";
    await notify(deal.from_user, `✓ Your shift change (${label}) was approved in the MAIN program by ${user.name}.`);
    await notify(deal.to_user, `✓ Your shift change (${label}) was approved in the MAIN program by ${user.name}.`);
  }
  return json({ ok: true });
}
