import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// GET /api/availability -> everyone's preferences (future dates)
export async function GET() {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("availability")
    .select("user_id, date, preference, users(name)")
    .gte("date", today)
    .order("date");
  if (error) return json({ error: error.message }, 500);
  return json({ availability: data, me: user.id });
}

// POST /api/availability { date, preference: "want_to_work"|"prefer_off"|"clear" }
export async function POST(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { date, preference } = await req.json();
  if (!date) return json({ error: "Date required" }, 400);

  if (preference === "clear") {
    await db.from("availability").delete().eq("user_id", user.id).eq("date", date);
    return json({ ok: true });
  }
  if (!["want_to_work", "prefer_off"].includes(preference))
    return json({ error: "Invalid preference" }, 400);

  const { error } = await db
    .from("availability")
    .upsert({ user_id: user.id, date, preference }, { onConflict: "user_id,date" });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
