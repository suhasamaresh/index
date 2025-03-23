import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import { decryptWithVault } from "../../../../lib/vault-client";

const prisma = new PrismaClient();

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Attempting to authorize:", credentials);
        if (!credentials?.username || !credentials?.password) {
          console.log("Missing username or password");
          return null;
        }
        const user = await prisma.userIndexPrefs.findFirst({
          where: { webhookId: credentials.username },
        });
        console.log("User from DB:", user ? { ...user, pgCreds: user.pgCreds ? Buffer.from(user.pgCreds).toString("utf8") : null } : "Not found");
        if (!user || !user.pgCreds) {
          console.log("No user found or pgCreds missing");
          return null;
        }
        try {
          const storedCiphertext = Buffer.from(user.pgCreds).toString("utf8"); // Fix: Explicit Buffer conversion
          console.log("Ciphertext to decrypt:", storedCiphertext);
          const storedPassword = await decryptWithVault(storedCiphertext);
          console.log("Decrypted password:", storedPassword);
          console.log("Provided password:", credentials.password);
          console.log("Passwords match:", storedPassword === credentials.password);
          if (storedPassword === credentials.password) {
            console.log("Authentication successful");
            return { id: user.userId, name: credentials.username };
          }
          console.log("Password mismatch");
          return null;
        } catch (error) {
          console.error("Decryption error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  jwt: { secret: process.env.JWT_SECRET },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user = { ...session.user, id: token.id as string } as { id: string } & typeof session.user;
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
});

export { handler as GET, handler as POST };