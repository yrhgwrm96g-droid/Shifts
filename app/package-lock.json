import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// POST /api/password { current_password, new_password }
export async function POST(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { current_password, new_password } = await req.json();

  if (!new_password || new_password.length < 8)
    return json({ error: "New password must be at least 8 characters" }, 400);

  const { data: dbUser } = await db
    .from("users").select("password_hash").eq("id", user.id).maybeSingle();
  if (!dbUser) return json({ error: "User not found" }, 404);

  const ok = await bcrypt.compare(current_password || "", dbUser.password_hash);
  if (!ok) return json({ error: "Current password is wrong" }, 400);

  const hash = await bcrypt.hash(new_password, 10);
  const { error } = await db
    .from("users")
    .update({ password_hash: hash, must_change_password: false })
    .eq("id", user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
