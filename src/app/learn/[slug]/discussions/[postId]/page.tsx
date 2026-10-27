import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { createPostAction, deletePostAction } from "@/server/actions/learning";
import { getLearningContext } from "@/server/learning-context";
import { guard } from "@/server/page-guard";
import { canModeratePost } from "@/server/policies";
import { getThread } from "@/server/services/community";

export default async function ThreadPage({ params }: { params: Promise<{ slug: string; postId: string }> }) {
  const { slug, postId } = await params;
  const { user, course } = await getLearningContext(slug);
  const { thread } = await guard(() => getThread(db, user, slug, postId));
  const posts = [thread, ...thread.replies];

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/learn/${course.slug}/discussions`} className="hover:underline">← All discussions</Link>}
        title={thread.title ?? "Discussion"}
      />
      <ol className="space-y-4">
        {posts.map((p, i) => (
          <li key={p.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">
                <span className="font-medium">{p.author.name}</span>
                {p.author.role.name !== "STUDENT" && (
                  <Badge variant="secondary" className="ml-2 capitalize">
                    {p.author.role.name.toLowerCase()}
                  </Badge>
                )}
                <span className="text-muted-foreground ml-2 text-xs">{formatDate(p.createdAt, true)}</span>
              </p>
              {canModeratePost(user, { authorId: p.author.id }, course) && (
                <ActionForm action={deletePostAction.bind(null, p.id)} confirm={i === 0 ? "Delete this discussion and all replies?" : "Delete this reply?"} showSuccess={false}>
                  <SubmitButton variant="ghost" size="icon" aria-label={i === 0 ? "Delete discussion" : "Delete reply"}>
                    <Trash2 aria-hidden />
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
            <p className="mt-2 text-sm whitespace-pre-line">{p.body}</p>
          </li>
        ))}
      </ol>
      {course.status !== "ARCHIVED" && (
        <ActionForm action={createPostAction.bind(null, course.id)} className="mt-6 grid gap-3" resetOnSuccess aria-label="Reply">
          <input type="hidden" name="parentId" value={thread.id} />
          <FormField id="body" label="Your reply">
            <Textarea id="body" name="body" required maxLength={5000} rows={4} />
          </FormField>
          <div>
            <SubmitButton pendingText="Posting…">Post reply</SubmitButton>
          </div>
        </ActionForm>
      )}
      <Button asChild variant="link" className="mt-4 px-0">
        <Link href={`/learn/${course.slug}/discussions`}>Back to discussions</Link>
      </Button>
    </>
  );
}
