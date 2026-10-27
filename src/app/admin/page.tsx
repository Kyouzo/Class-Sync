import type { Metadata } from "next";
import { Search } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Pagination, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { firstParam, formatDate, parsePage } from "@/lib/utils";
import { setUserRoleAction } from "@/server/actions/admin";
import { requireRole } from "@/server/session";
import { getPlatformStats, listUsers } from "@/server/services/admin";

export const metadata: Metadata = { title: "Admin · Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim().slice(0, 100) || undefined;
  const page = parsePage(sp.page);
  const [stats, result] = await Promise.all([getPlatformStats(db, user), listUsers(db, user, { q, page })]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.usersByRole.map((r) => (
          <StatCard key={r.role} label={`${r.role.charAt(0)}${r.role.slice(1).toLowerCase()}s`} value={r.count} />
        ))}
        <StatCard label="Enrollments" value={stats.enrollments} />
        <StatCard label="Certificates" value={stats.certificates} />
      </div>

      <form role="search" method="get" className="flex gap-2">
        <Input name="q" type="search" placeholder="Search by name or email" defaultValue={q ?? ""} aria-label="Search users" className="max-w-sm" />
        <Button type="submit" variant="secondary">
          <Search aria-hidden /> Search
        </Button>
      </form>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Courses taught</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground block text-xs">{u.email}</span>
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>{u._count.enrollments}</TableCell>
                  <TableCell>{u._count.coursesTaught}</TableCell>
                  <TableCell>
                    {u.id === user.id ? (
                      <span className="text-sm">Admin (you)</span>
                    ) : (
                      <ActionForm action={setUserRoleAction} className="flex items-center gap-2" aria-label={`Role for ${u.name}`}>
                        <input type="hidden" name="userId" value={u.id} />
                        <NativeSelect name="role" defaultValue={u.role.name} aria-label={`Role for ${u.name}`} className="w-36">
                          <option value="STUDENT">Student</option>
                          <option value="INSTRUCTOR">Instructor</option>
                          <option value="ADMIN">Admin</option>
                        </NativeSelect>
                        <SubmitButton size="sm" variant="outline">
                          Save
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
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin" params={{ q }} />
    </div>
  );
}
