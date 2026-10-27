import Link from "next/link";
import { requireRole } from "@/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  const tabs = [
    { href: "/admin", label: "Users" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/categories", label: "Categories" },
  ];
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight sm:text-3xl">Administration</h1>
      <nav aria-label="Administration" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap hover:border-current">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
