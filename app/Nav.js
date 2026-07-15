import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET -> minimal user list (id, name) for pickers. Any signed-in user.
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { data, error } = await db
    .from("users")
    .select("id, username, name, role")
    .order("name");
  if (error) return json({ error: error.message }, 500);
  return json({ users: data });
}
