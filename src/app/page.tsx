import Link from "next/link";
import { Award, BookOpen, ChartColumn, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { db } from "@/lib/db";
import { listPublishedCourses } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

const features = [
  { icon: BookOpen, title: "Structured courses", text: "Modules, text lessons, learning objectives and downloadable resources." },
  { icon: ClipboardCheck, title: "Auto-graded quizzes", text: "Multiple-choice quizzes with passing scores, attempt limits and history." },
  { icon: ChartColumn, title: "Progress insights", text: "Learners track completion; instructors see progress and results." },
  { icon: Award, title: "Verified certificates", text: "Issued only when completion requirements are met, verifiable online." },
];

export default async function HomePage() {
  const { courses } = await listPublishedCourses(db, { page: 1 });
  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl pt-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Learn, teach and track progress in one place.</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          ClassSync is an open-source learning management system for publishing courses, running quizzes and issuing certificates.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/courses">Browse courses</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/register">Create a free account</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="features" className="sr-only">
          Features
        </h2>
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="bg-card rounded-xl border p-5">
            <Icon className="text-primary size-6" aria-hidden />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{text}</p>
          </div>
        ))}
      </section>

      {courses.length > 0 && (
        <section aria-labelledby="latest">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="latest" className="text-2xl font-semibold">
              Latest courses
            </h2>
            <Link href="/courses" className="text-primary text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((course) => (
              <div key={course.slug} className="relative">
                <CourseCard course={course} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
