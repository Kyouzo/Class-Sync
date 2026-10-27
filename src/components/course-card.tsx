import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type CourseCardData = {
  slug: string;
  title: string;
  summary: string;
  category: { name: string } | null;
  instructor: { name: string };
  _count: { modules: number; enrollments: number };
};

export function CourseCard({ course }: { course: CourseCardData }) {
  return (
    <Card className="relative h-full transition-shadow hover:shadow-md">
      <CardHeader>
        {course.category && (
          <Badge variant="secondary" className="mb-1">
            {course.category.name}
          </Badge>
        )}
        <CardTitle className="text-lg">
          <Link href={`/courses/${course.slug}`} className="after:absolute after:inset-0 hover:underline focus-visible:underline">
            {course.title}
          </Link>
        </CardTitle>
        <CardDescription className="line-clamp-3">{course.summary}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground mt-auto text-sm">By {course.instructor.name}</CardContent>
      <CardFooter className="text-muted-foreground gap-4 text-xs">
        <span className="flex items-center gap-1">
          <BookOpen className="size-3.5" aria-hidden /> {course._count.modules} modules
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden /> {course._count.enrollments} learners
        </span>
      </CardFooter>
    </Card>
  );
}
