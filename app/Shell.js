import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET /api/marketplace -> open offers (pending + awaiting confirmation)
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await db
    .from("swap_requests")
    .select(`
      id, type, portion, note, status, created_at, from_user, to_user,
      shift:shifts!swap_requests_shift_id_fkey(id, date, start_time, end_time),
      offered:shifts!swap_requests_offered_shift_id_fkey(id, date, start_time, end_time),
      poster:users!swap_requests_from_user_fkey(name, username),
      proposer:users!swap_requests_to_user_fkey(name, username)
    `)
    .in("status", ["pending", "awaiting_confirm"])
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  const today = new Date().toISOString().slice(0, 10);
  const offers = (data || []).filter((o) => o.shift && o.shift.date >= today);
  return json({ offers, me: user.id });
}
