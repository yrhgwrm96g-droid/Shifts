import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET -> latest 100 swap requests with names, for the admin Activity tab
export async function GET() {
  const user = await currentUser();
  if (!user || user.role !== "admin") return json({ error: "Admins only" }, 403);

  const { data, error } = await db
    .from("swap_requests")
    .select(`
      id, type, portion, note, status, created_at, resolved_at,
      shifts(date, start_time, end_time),
      from:users!swap_requests_from_user_fkey(name, username),
      to:users!swap_requests_to_user_fkey(name, username)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: error.message }, 500);
  return json({ requests: data });
}
