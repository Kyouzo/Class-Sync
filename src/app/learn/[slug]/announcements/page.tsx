import { PageHeader, EmptyState } from "@/components/shared";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getLearningContext } from "@/server/learning-context";
import { guard } from "@/server/page-guard";
import { listAnnouncements } from "@/server/services/community";

export default async function AnnouncementsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await getLearningContext(slug);
  const { announcements } = await guard(() => listAnnouncements(db, user, slug));
  return (
    <>
      <PageHeader title="Announcements" description="Updates from your instructor." />
      {announcements.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <ul className="space-y-4">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-lg border p-4">
              <h2 className="font-semibold">{a.title}</h2>
              <p className="text-muted-foreground text-xs">
                {a.author.name} · {formatDate(a.createdAt, true)}
              </p>
              <p className="mt-2 text-sm whitespace-pre-line">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
