// pages/api/auth/[...nextauth].ts
import NextAuth, { Session } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import { decryptWithVault } from "../../../lib/vault-client";

const prisma = new PrismaClient();

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Find user by webhookId (proxy for username)
        const user = await prisma.userIndexPrefs.findFirst({
          where: { webhookId: credentials.username },
        });

        if (!user || !user.pgCreds) return null;

        // Decrypt stored credentials from Vault
        const storedPassword = await decryptWithVault(user.pgCreds.toString());

        if (storedPassword === credentials.password) {
          return { id: user.userId, name: credentials.username };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Add userId to JWT
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        if (session.user) {
          session.user.id = token.id as string; // Pass userId to session
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});