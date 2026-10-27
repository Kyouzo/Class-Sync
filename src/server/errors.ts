export type AppErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT";

/** Domain error thrown by services; server actions convert it into a user-facing message. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "You must be signed in.") => new AppError("UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have permission to do that.") => new AppError("FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError("NOT_FOUND", message);
export const conflict = (message: string) => new AppError("CONFLICT", message);
export const invalid = (message: string, fieldErrors?: Record<string, string[] | undefined>) =>
  new AppError("VALIDATION", message, fieldErrors);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
