import { requireRole } from "@/server/session";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("INSTRUCTOR", "ADMIN");
  return children;
}
