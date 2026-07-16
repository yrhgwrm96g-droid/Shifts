import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./supabase";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Username and password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase();
        const password = credentials?.password || "";
        if (!username || !password) return null;

        const { data: user } = await db
          .from("users")
          .select("id, username, name, role, password_hash")
          .eq("username", username)
          .maybeSingle();
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        return { id: user.id, name: user.name || user.username, username: user.username };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) token.userId = user.id;
      const stale = !token.checkedAt || Date.now() - token.checkedAt > 60000;
      const force = trigger === "update" || trigger === "signIn" || !token.role;
      if (token?.userId && (stale || force)) {
        const { data: dbUser } = await db
          .from("users")
          .select("id, role, name, username, must_change_password")
          .eq("id", token.userId)
          .maybeSingle();
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.name || dbUser.username;
          token.username = dbUser.username;
          token.mustChange = dbUser.must_change_password;
        }
        token.checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.username = token.username;
      session.user.mustChange = token.mustChange;
      return session;
    },
  },
};
