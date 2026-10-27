import type { DefaultSession } from "next-auth";
import type { RoleName } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: RoleName;
  }
}
