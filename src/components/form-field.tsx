import type { ReactNode } from "react";
import { Label } from "@/components/ui/input";
import { FieldError } from "./action-form";

/** Label + control + hint + validation message, consistently spaced. */
export function FormField({
  id,
  label,
  hint,
  children,
  name,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
  /** Field name used for server-side validation messages (defaults to id). */
  name?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FieldError name={name ?? id} />
    </div>
  );
}
