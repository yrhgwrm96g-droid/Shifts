import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET /api/marketplace -> all pending offers with shift + owner info
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await db
    .from("swap_requests")
    .select("id, type, portion, note, created_at, from_user, shifts(id, date, start_time, end_time), users!swap_requests_from_user_fkey(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  // Only future shifts
  const today = new Date().toISOString().slice(0, 10);
  const offers = (data || []).filter((o) => o.shifts && o.shifts.date >= today);
  return json({ offers, me: user.id });
}
