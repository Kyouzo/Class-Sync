import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { isAppError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { getCertificateForDownload, renderCertificatePdf } from "@/server/services/certificates";

/** Generates the certificate PDF on demand from the stored certificate record. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const certificate = await getCertificateForDownload(db, user, (await params).id);
    const baseUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const pdf = await renderCertificatePdf(certificate, baseUrl.replace(/\/$/, ""));
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${slugify(certificate.courseTitle)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return new Response(error.message, { status: error.code === "UNAUTHENTICATED" ? 401 : 404 });
    }
    throw error;
  }
}
