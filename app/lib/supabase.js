import { createClient } from "@supabase/supabase-js";

// Lazily create the client on first use, so the app can BUILD
// even before environment variables are available.
// Never import this file in a client component.
let client = null;

function getClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getClient();
      const value = real[prop];
      return typeof value === "function" ? value.bind(real) : value;
    },
  }
);
