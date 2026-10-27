import Link from "next/link";
import type { Metadata } from "next";
import { CircleCheck, Clock, ListChecks, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Markdown, StatusBadge } from "@/components/shared";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { enrollAction } from "@/server/actions/learning";
import { guard } from "@/server/page-guard";
import { getCurrentUser } from "@/server/session";
import { getCourseOverview } from "@/server/services/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await db.course.findUnique({ where: { slug: (await params).slug }, select: { title: true, summary: true, status: true } });
  return course?.status === "PUBLISHED" ? { title: course.title, description: course.summary } : { title: "Course" };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const { course, enrollment, canManage, canEnroll } = await guard(() => getCourseOverview(db, user, slug));
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const minutes = course.modules.flatMap((m) => m.lessons).reduce((n, l) => n + (l.estimatedMinutes ?? 0), 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {course.category && <Badge variant="secondary">{course.category.name}</Badge>}
            {course.status !== "PUBLISHED" && <StatusBadge status={course.status} />}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="text-muted-foreground text-lg">{course.summary}</p>
          <p className="text-sm">
            Instructor: <span className="font-medium">{course.instructor.name}</span>
          </p>
        </div>

        <section aria-labelledby="about">
          <h2 id="about" className="mb-2 text-xl font-semibold">
            About this course
          </h2>
          <Markdown>{course.description}</Markdown>
        </section>

        {course.objectives.length > 0 && (
          <section aria-labelledby="objectives">
            <h2 id="objectives" className="mb-3 text-xl font-semibold">
              What you will learn
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {course.objectives.map((o) => (
                <li key={o} className="flex gap-2 text-sm">
                  <CircleCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden /> {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="syllabus">
          <h2 id="syllabus" className="mb-3 text-xl font-semibold">
            Syllabus
          </h2>
          <ol className="space-y-3">
            {course.modules.map((m, i) => (
              <li key={m.id} className="rounded-lg border p-4">
                <p className="font-medium">
                  Module {i + 1}: {m.title}
                </p>
                <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      {l.title}
                      {l.estimatedMinutes ? ` · ${l.estimatedMinutes} min` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside>
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Course details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <ListChecks className="size-4" aria-hidden /> {lessonCount} lessons · {course.quizzes.length} quizzes
              </li>
              {minutes > 0 && (
                <li className="flex items-center gap-2">
                  <Clock className="size-4" aria-hidden /> About {Math.ceil(minutes / 60)} hour{minutes > 60 ? "s" : ""}
                </li>
              )}
              <li className="flex items-center gap-2">
                <Users className="size-4" aria-hidden /> {course._count.enrollments} enrolled
              </li>
            </ul>
            <div className="text-muted-foreground border-t pt-3 text-xs">
              <p className="text-foreground mb-1 font-medium">Certificate requirements</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {course.requireAllLessons && <li>Complete every lesson</li>}
                {course.requirePassingQuizzes && course.quizzes.some((q) => q.isRequired) && <li>Pass all required quizzes</li>}
                {course.minimumGrade !== null && <li>Course grade of at least {course.minimumGrade}%</li>}
              </ul>
            </div>

            {enrollment ? (
              <Button asChild className="w-full">
                <Link href={`/learn/${course.slug}`}>{enrollment.status === "COMPLETED" ? "Review course" : "Continue learning"}</Link>
              </Button>
            ) : canEnroll ? (
              <ActionForm action={enrollAction.bind(null, course.id)}>
                <SubmitButton className="w-full" pendingText="Enrolling…">
                  Enroll for free
                </SubmitButton>
              </ActionForm>
            ) : !user ? (
              <Button asChild className="w-full">
                <Link href={`/login?callbackUrl=/courses/${course.slug}`}>Sign in to enroll</Link>
              </Button>
            ) : canManage ? null : (
              <Alert variant="info">Only student accounts can enroll in courses.</Alert>
            )}
            {canManage && (
              <div className="grid gap-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/instructor/courses/${course.id}`}>Manage course</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href={`/learn/${course.slug}`}>Preview content</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
