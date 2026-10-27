import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBadge } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { setCourseStatusAction } from "@/server/actions/courses";
import { requireRole } from "@/server/session";
import { listAllCourses } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Courses" };

export default async function AdminCoursesPage() {
  const user = await requireRole("ADMIN");
  const courses = await listAllCourses(db, user);
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/instructor/courses/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell>{c.instructor.name}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell>{c._count.enrollments}</TableCell>
                <TableCell>{formatDate(c.updatedAt)}</TableCell>
                <TableCell>
                  {c.status === "PUBLISHED" && (
                    <ActionForm action={setCourseStatusAction.bind(null, c.id, "ARCHIVED")} confirm={`Archive "${c.title}"?`}>
                      <SubmitButton size="sm" variant="outline">
                        Archive
                      </SubmitButton>
                    </ActionForm>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
