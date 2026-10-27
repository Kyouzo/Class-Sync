import Link from "next/link";
import { Circle, CircleCheck, ClipboardCheck, House, Megaphone, MessagesSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/utils";
import { getLearningContext } from "@/server/learning-context";

export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { course, standing, canManage, enrollment } = await getLearningContext(slug);
  const base = `/learn/${course.slug}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
      {/* On small screens the page content comes first and the course navigation follows it. */}
      <aside aria-label="Course navigation" className="order-last space-y-5 border-t pt-6 lg:order-none lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:border-t-0 lg:pt-0">
        <div className="space-y-2">
          <Link href={`/courses/${course.slug}`} className="font-semibold hover:underline">
            {course.title}
          </Link>
          {course.status !== "PUBLISHED" && <StatusBadge status={course.status} />}
          {standing && (
            <div className="space-y-1">
              <Progress value={standing.evaluation.progress} label="Course progress" />
              <p className="text-muted-foreground text-xs">{formatPercent(standing.evaluation.progress)} of lessons complete</p>
            </div>
          )}
        </div>
        <nav className="space-y-1 text-sm">
          <Link href={base} className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5">
            <House className="size-4" aria-hidden /> Overview
          </Link>
          <Link href={`${base}/announcements`} className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5">
            <Megaphone className="size-4" aria-hidden /> Announcements
          </Link>
          <Link href={`${base}/discussions`} className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5">
            <MessagesSquare className="size-4" aria-hidden /> Discussions
          </Link>
        </nav>
        <nav aria-label="Lessons" className="space-y-4 text-sm">
          {course.modules.map((m, i) => (
            <div key={m.id}>
              <p className="text-muted-foreground mb-1 px-2 text-xs font-semibold tracking-wide uppercase">
                {i + 1}. {m.title}
              </p>
              <ul>
                {m.lessons.map((l) => {
                  const done = standing?.completedLessonIds.has(l.id);
                  return (
                    <li key={l.id}>
                      <Link href={`${base}/lessons/${l.id}`} className="hover:bg-accent flex items-start gap-2 rounded-md px-2 py-1.5">
                        {done ? (
                          <CircleCheck className="text-success mt-0.5 size-4 shrink-0" aria-label="Completed" />
                        ) : (
                          <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-label="Not completed" />
                        )}
                        <span>{l.title}</span>
                      </Link>
                    </li>
                  );
                })}
                {course.quizzes
                  .filter((q) => q.moduleId === m.id)
                  .map((q) => {
                    const passed = standing?.quizzes.find((s) => s.quizId === q.id)?.passed;
                    return (
                      <li key={q.id}>
                        <Link href={`${base}/quizzes/${q.id}`} className="hover:bg-accent flex items-start gap-2 rounded-md px-2 py-1.5">
                          <ClipboardCheck className={`mt-0.5 size-4 shrink-0 ${passed ? "text-success" : "text-primary"}`} aria-hidden />
                          <span>
                            {q.title}
                            {passed && <span className="sr-only"> (passed)</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          {course.quizzes.some((q) => !q.moduleId) && (
            <div>
              <p className="text-muted-foreground mb-1 px-2 text-xs font-semibold tracking-wide uppercase">Course quizzes</p>
              <ul>
                {course.quizzes
                  .filter((q) => !q.moduleId)
                  .map((q) => (
                    <li key={q.id}>
                      <Link href={`${base}/quizzes/${q.id}`} className="hover:bg-accent flex items-start gap-2 rounded-md px-2 py-1.5">
                        <ClipboardCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden /> {q.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </nav>
      </aside>
      <div className="min-w-0">
        {canManage && !enrollment && (
          <Alert variant="info" className="mb-6">
            Instructor preview: progress tracking and quiz submission are only available to enrolled students.
          </Alert>
        )}
        {children}
      </div>
    </div>
  );
}
