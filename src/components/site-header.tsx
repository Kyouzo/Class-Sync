import Link from "next/link";
import { Bell, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/session";
import { countUnseenNotifications } from "@/server/services/notifications";
import { UserMenu, type NavLink } from "./user-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unseen = user ? await countUnseenNotifications(db, user) : 0;

  const links: NavLink[] = [{ href: "/courses", label: "Courses" }];
  if (user) links.push({ href: "/dashboard", label: "Dashboard" });
  if (user?.role === "INSTRUCTOR" || user?.role === "ADMIN") links.push({ href: "/instructor", label: "Teach" });
  if (user?.role === "ADMIN") links.push({ href: "/admin", label: "Admin" });

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="text-primary size-6" aria-hidden />
          <span>ClassSync</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link href="/notifications" aria-label={unseen ? `Notifications (${unseen} new)` : "Notifications"}>
                  <Bell aria-hidden />
                  {unseen > 0 && (
                    <span className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
                      {unseen > 9 ? "9+" : unseen}
                    </span>
                  )}
                </Link>
              </Button>
              <UserMenu user={{ name: user.name, email: user.email, role: user.role }} links={links} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
