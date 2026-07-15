import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET -> all users
export async function GET() {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { data, error } = await db
    .from("users")
    .select("id, username, name, role, must_change_password, created_at")
    .order("created_at");
  if (error) return json({ error: error.message }, 500);
  return json({ users: data });
}

// POST { username, name?, temp_password, role? } -> create account
// POST { reset_id, temp_password }               -> reset a user's password
export async function POST(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const body = await req.json();

  if (body.reset_id) {
    if (!body.temp_password || body.temp_password.length < 8)
      return json({ error: "Temporary password must be at least 8 characters" }, 400);
    const hash = await bcrypt.hash(body.temp_password, 10);
    const { error } = await db
      .from("users")
      .update({ password_hash: hash, must_change_password: true })
      .eq("id", body.reset_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const username = body.username?.trim().toLowerCase();
  if (!username || !/^[a-z0-9._-]{3,30}$/.test(username))
    return json({ error: "Username: 3-30 characters, letters/numbers/dots/dashes only" }, 400);
  if (!body.temp_password || body.temp_password.length < 8)
    return json({ error: "Temporary password must be at least 8 characters" }, 400);

  const hash = await bcrypt.hash(body.temp_password, 10);
  const { error } = await db.from("users").insert({
    username,
    name: body.name?.trim() || null,
    password_hash: hash,
    role: body.role === "admin" ? "admin" : "user",
  });
  if (error) {
    if (error.code === "23505") return json({ error: "That username is already taken" }, 400);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
}

// DELETE { id } -> remove a user (and their shifts, via cascade)
export async function DELETE(req) {
  const admin = await requireAdmin();
  if (!admin) return json({ error: "Admins only" }, 403);
  const { id } = await req.json();
  if (id === admin.id) return json({ error: "You cannot delete yourself" }, 400);
  const { error } = await db.from("users").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
