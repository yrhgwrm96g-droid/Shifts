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
    .from("users").select("*").order("created_at");
  if (error) return json({ error: error.message }, 500);
  return json({ users: data });
}

// POST { email, role? } -> whitelist a new user
export async function POST(req) {
  if (!(await requireAdmin())) return json({ error: "Admins only" }, 403);
  const { email, role } = await req.json();
  if (!email) return json({ error: "Email required" }, 400);
  const { error } = await db.from("users").insert({
    email: email.trim().toLowerCase(),
    role: role === "admin" ? "admin" : "user",
  });
  if (error) return json({ error: error.message }, 500);
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
