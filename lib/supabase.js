import { createClient } from "@supabase/supabase-js";

// Server-side client using the service role key.
// Never import this file in a client component.
export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
