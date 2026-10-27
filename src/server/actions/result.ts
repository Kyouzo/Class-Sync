import { isAppError } from "../errors";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Changes on every successful submit so forms can reset themselves. */
  submittedAt?: number;
};

export const initialActionState: ActionState = {};

export function success(message = "Saved."): ActionState {
  return { ok: true, message, submittedAt: Date.now() };
}

/** Runs a service call, turning domain errors into form state. Unexpected errors are logged, not leaked. */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; state: ActionState }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false, state: { ok: false, error: error.message, fieldErrors: error.fieldErrors } };
    }
    console.error(error);
    return { ok: false, state: { ok: false, error: "Something went wrong. Please try again." } };
  }
}
