import type { Metadata } from "next";
import { BadgeCheck, CircleX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { verifyCertificate } from "@/server/services/certificates";

export const metadata: Metadata = { title: "Verify certificate", robots: { index: false } };

/** Public certificate verification page. */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const certificate = /^[A-Za-z0-9-]{6,40}$/.test(code) ? await verifyCertificate(db, code) : null;

  return (
    <Card className="mx-auto max-w-xl">
      {certificate ? (
        <>
          <CardHeader className="items-center text-center">
            <BadgeCheck className="text-success size-10" aria-hidden />
            <CardTitle className="text-2xl">Valid certificate</CardTitle>
            <CardDescription>Certificate {certificate.code}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Recipient</dt>
              <dd className="font-medium">{certificate.recipientName}</dd>
              <dt className="text-muted-foreground">Course</dt>
              <dd className="font-medium">{certificate.courseTitle}</dd>
              <dt className="text-muted-foreground">Instructor</dt>
              <dd>{certificate.instructorName}</dd>
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatDate(certificate.issuedAt)}</dd>
              {certificate.finalGrade !== null && (
                <>
                  <dt className="text-muted-foreground">Final grade</dt>
                  <dd>{Number(certificate.finalGrade)}%</dd>
                </>
              )}
            </dl>
          </CardContent>
        </>
      ) : (
        <CardHeader className="items-center text-center">
          <CircleX className="text-destructive size-10" aria-hidden />
          <CardTitle className="text-2xl">Certificate not found</CardTitle>
          <CardDescription>No certificate matches the code “{code}”.</CardDescription>
        </CardHeader>
      )}
    </Card>
  );
}
