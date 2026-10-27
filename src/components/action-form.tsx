"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initialActionState, type ActionState } from "@/server/actions/result";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>(initialActionState);

/**
 * Wraps a server action with `useActionState`, showing success/error feedback and exposing field
 * errors to `<FieldError>` children. Works as a plain form before hydration.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  showSuccess = true,
  ...rest
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask for confirmation before submitting (destructive actions). */
  confirm?: string;
  showSuccess?: boolean;
  "aria-label"?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok && state.submittedAt) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormStateContext.Provider value={state}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(event) => {
          if (confirm && !window.confirm(confirm)) event.preventDefault();
        }}
        {...rest}
      >
        {children}
        <FormMessage state={state} showSuccess={showSuccess} />
      </form>
    </FormStateContext.Provider>
  );
}

function FormMessage({ state, showSuccess }: { state: ActionState; showSuccess: boolean }) {
  if (state.error) {
    return (
      <p role="alert" className="text-destructive mt-2 flex items-start gap-1.5 text-sm">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.error}
      </p>
    );
  }
  if (state.ok && state.message && showSuccess) {
    return (
      <p role="status" className="text-success mt-2 flex items-start gap-1.5 text-sm">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
      </p>
    );
  }
  return null;
}

export function FieldError({ name }: { name: string }) {
  const state = useContext(FormStateContext);
  const messages = state.fieldErrors?.[name];
  if (!messages?.length) return null;
  return (
    <p id={`${name}-error`} className="text-destructive text-sm">
      {messages[0]}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className,
  variant,
  size,
  disabled,
  ...rest
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  "aria-label"?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending || disabled} className={cn(className)} {...rest}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
