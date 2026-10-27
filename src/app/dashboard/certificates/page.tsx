import Link from "next/link";
import type { Metadata } from "next";
import { Award, Download } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { listUserCertificates } from "@/server/services/certificates";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const user = await requireUser();
  const certificates = await listUserCertificates(db, user);
  return (
    <>
      <PageHeader title="Certificates" description="Certificates are issued when you meet a course's completion requirements." />
      {certificates.length === 0 ? (
        <EmptyState title="No certificates yet" description="Complete a course to earn your first certificate." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certificates.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <Award className="text-primary size-6" aria-hidden />
                <CardTitle>{c.courseTitle}</CardTitle>
                <CardDescription>
                  Issued {formatDate(c.issuedAt)}
                  {c.finalGrade !== null && ` · Final grade ${Number(c.finalGrade)}%`}
                  <br />
                  ID {c.code}
                </CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <Button asChild size="sm">
                  <a href={`/api/certificates/${c.id}`} download>
                    <Download aria-hidden /> Download PDF
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/certificates/${c.code}`}>Verify</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
