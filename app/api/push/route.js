import { db } from "@/lib/supabase";
import { currentUser, json } from "@/lib/session";

// POST { subscription } -> save this device's push subscription
export async function POST(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { subscription } = await req.json();
  if (!subscription?.endpoint) return json({ error: "Invalid subscription" }, 400);
  const { error } = await db.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: subscription.endpoint, subscription },
    { onConflict: "endpoint" }
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

// DELETE { endpoint } -> remove this device's subscription
export async function DELETE(req) {
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  const { endpoint } = await req.json();
  await db.from("push_subscriptions").delete()
    .eq("user_id", user.id).eq("endpoint", endpoint);
  return json({ ok: true });
}
