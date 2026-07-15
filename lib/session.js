import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// Helper for API routes: returns the session user or null.
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user; // { id, role, name, email }
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}
