import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Certificate } from "@prisma/client";
import type { Db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { notFound, unauthenticated } from "../errors";
import { canViewLearnerRecords, type Actor } from "../policies";

export async function listUserCertificates(db: Db, actor: Actor) {
  return db.certificate.findMany({
    where: { userId: actor.id },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { slug: true } } },
  });
}

/** Certificate download: the recipient, the course's instructor, or an administrator. */
export async function getCertificateForDownload(db: Db, actor: Actor | null, certificateId: string) {
  if (!actor) throw unauthenticated();
  const certificate = await db.certificate.findUnique({
    where: { id: certificateId },
    include: { course: { select: { instructorId: true } } },
  });
  if (!certificate || !canViewLearnerRecords(actor, certificate.userId, certificate.course)) {
    throw notFound("Certificate not found.");
  }
  return certificate;
}

/** Public verification by code. Exposes only what is printed on the certificate itself. */
export async function verifyCertificate(db: Db, code: string) {
  return db.certificate.findUnique({
    where: { code: code.toUpperCase() },
    select: { code: true, recipientName: true, courseTitle: true, instructorName: true, issuedAt: true, finalGrade: true },
  });
}

/** Renders a landscape A4 PDF from the stored certificate record. */
export async function renderCertificatePdf(
  certificate: Pick<Certificate, "code" | "recipientName" | "courseTitle" | "instructorName" | "issuedAt" | "finalGrade">,
  verifyBaseUrl: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of Completion - ${certificate.courseTitle}`);
  pdf.setAuthor("ClassSync");
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.09, 0.1, 0.12);
  const accent = rgb(0.15, 0.3, 0.75);
  const muted = rgb(0.4, 0.42, 0.47);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: accent, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: accent, borderWidth: 0.75 });

  // pdf-lib standard fonts only support WinAnsi; replace anything else so rendering never throws.
  const clean = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const center = (text: string, y: number, size: number, font = serif, color = ink) => {
    const value = clean(text);
    let fontSize = size;
    while (font.widthOfTextAtSize(value, fontSize) > width - 120 && fontSize > 10) fontSize -= 1;
    page.drawText(value, { x: (width - font.widthOfTextAtSize(value, fontSize)) / 2, y, size: fontSize, font, color });
  };

  center("CLASSSYNC", height - 100, 16, sans, accent);
  center("Certificate of Completion", height - 160, 38, serifBold);
  center("This certifies that", height - 215, 16, serif, muted);
  center(certificate.recipientName, height - 265, 34, serifBold);
  center("has successfully completed the course", height - 310, 16, serif, muted);
  center(certificate.courseTitle, height - 355, 26, serifBold, accent);
  const grade = certificate.finalGrade !== null ? ` with a final grade of ${Number(certificate.finalGrade)}%` : "";
  center(`Issued ${formatDate(certificate.issuedAt)}${grade}`, height - 395, 14, serif, ink);
  center(`Instructor: ${certificate.instructorName}`, height - 420, 13, serif, muted);
  center(`Certificate ID ${certificate.code}  -  verify at ${verifyBaseUrl}/certificates/${certificate.code}`, 70, 10, sans, muted);

  return pdf.save();
}
