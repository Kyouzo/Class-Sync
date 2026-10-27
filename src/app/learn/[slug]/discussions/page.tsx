import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { EmptyState, PageHeader, Pagination } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatDate, parsePage } from "@/lib/utils";
import { createPostAction } from "@/server/actions/learning";
import { getLearningContext } from "@/server/learning-context";
import { guard } from "@/server/page-guard";
import { listThreads } from "@/server/services/community";

export default async function DiscussionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const page = parsePage((await searchParams).page);
  const { user, course } = await getLearningContext(slug);
  const result = await guard(() => listThreads(db, user, slug, page));

  return (
    <>
      <PageHeader title="Discussions" description="Ask questions and help your classmates." />
      {course.status !== "ARCHIVED" && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Start a discussion</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={createPostAction.bind(null, course.id)} className="grid gap-4" aria-label="Start a discussion">
              <FormField id="title" label="Title">
                <Input id="title" name="title" required minLength={3} maxLength={160} />
              </FormField>
              <FormField id="body" label="Message">
                <Textarea id="body" name="body" required maxLength={5000} rows={4} />
              </FormField>
              <div>
                <SubmitButton pendingText="Posting…">Post discussion</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}
      {result.threads.length === 0 ? (
        <EmptyState title="No discussions yet" description="Be the first to start a conversation." />
      ) : (
        <ul className="divide-y rounded-lg border">
          {result.threads.map((t) => (
            <li key={t.id} className="p-4">
              <Link href={`/learn/${course.slug}/discussions/${t.id}`} className="font-medium hover:underline">
                {t.title}
              </Link>
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
                <span>
                  {t.author.name} · {formatDate(t.createdAt, true)}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" aria-hidden /> {t._count.replies} {t._count.replies === 1 ? "reply" : "replies"}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath={`/learn/${course.slug}/discussions`} />
    </>
  );
}
