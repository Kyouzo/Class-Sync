import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { isAppError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { getResourceForDownload } from "@/server/services/resources";

const STATUS = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409 } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { resource, body } = await getResourceForDownload(db, getStorage(), user, (await params).id);
    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": resource.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename="${resource.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) return new Response(error.message, { status: STATUS[error.code] });
    throw error;
  }
}
