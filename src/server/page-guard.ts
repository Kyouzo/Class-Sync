import "server-only";
import { notFound, redirect } from "next/navigation";
import { isAppError } from "./errors";

/**
 * Runs a service call for a page and maps domain errors to Next.js navigation:
 * not found -> 404, unauthenticated -> sign in, forbidden -> `forbiddenRedirect` (or /forbidden).
 */
export async function guard<T>(fn: () => Promise<T>, options: { forbiddenRedirect?: string } = {}): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAppError(error)) {
      if (error.code === "NOT_FOUND") notFound();
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "FORBIDDEN") redirect(options.forbiddenRedirect ?? "/forbidden");
    }
    throw error;
  }
}
