import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "./supabase";

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Whitelist check: only emails already present in the users table may sign in.
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;
      const { data: dbUser } = await db
        .from("users")
        .select("id, activated")
        .eq("email", email)
        .maybeSingle();
      if (!dbUser) return "/login?error=NotWhitelisted";
      if (!dbUser.activated) {
        await db
          .from("users")
          .update({ activated: true, name: user.name || email })
          .eq("id", dbUser.id);
      }
      return true;
    },
    async jwt({ token }) {
      if (token?.email) {
        const { data: dbUser } = await db
          .from("users")
          .select("id, role, name")
          .eq("email", token.email.toLowerCase())
          .maybeSingle();
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name || token.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
};
