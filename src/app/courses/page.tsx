import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { EmptyState, PageHeader, Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { db } from "@/lib/db";
import { catalogQuerySchema } from "@/lib/validation";
import { listCategories, listPublishedCourses } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Course catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = catalogQuerySchema.parse({ q: raw.q, category: raw.category, page: raw.page });
  const [categories, result] = await Promise.all([listCategories(db), listPublishedCourses(db, query)]);

  return (
    <>
      <PageHeader title="Course catalog" description="Browse published courses and enroll for free." />
      <form role="search" method="get" className="mb-6 grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" placeholder="Search by title or summary" defaultValue={query.q ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <NativeSelect id="category" name="category" defaultValue={query.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">
          <Search aria-hidden /> Search
        </Button>
      </form>

      <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
        {result.total} {result.total === 1 ? "course" : "courses"} found
      </p>
      {result.courses.length === 0 ? (
        <EmptyState title="No courses match your search" description="Try a different keyword or category." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/courses" params={{ q: query.q, category: query.category }} />
    </>
  );
}
