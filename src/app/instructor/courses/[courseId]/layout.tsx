import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { guard } from "@/server/page-guard";
import { requireRole } from "@/server/session";
import { requireManagedCourse } from "@/server/services/access";

export default async function ManageCourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireRole("INSTRUCTOR", "ADMIN");
  const course = await guard(() => requireManagedCourse(db, user, courseId));
  const base = `/instructor/courses/${course.id}`;
  const tabs = [
    { href: base, label: "Details" },
    { href: `${base}/content`, label: "Content & quizzes" },
    { href: `${base}/students`, label: "Students" },
    { href: `${base}/announcements`, label: "Announcements" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href="/instructor" className="text-muted-foreground text-sm hover:underline">
            ← Instructor dashboard
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{course.title}</h1>
            <StatusBadge status={course.status} />
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/courses/${course.slug}`}>
            <ExternalLink aria-hidden /> View course page
          </Link>
        </Button>
      </div>
      <nav aria-label="Course management" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="hover:text-foreground text-muted-foreground border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap hover:border-current">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
