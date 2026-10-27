import NextAuth from "next-auth";
import type { RoleName } from "@prisma/client";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

// Compared against when the email is unknown so response timing does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("classsync-timing-equaliser", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          include: { role: true },
        });
        const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.role = (user as { role?: RoleName }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
