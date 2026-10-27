import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "border-input placeholder:text-muted-foreground dark:bg-input/30 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/20";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-9 py-1 file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-20 py-2", className)} {...props} />;
}

/** Styled native select: accessible, works without JavaScript and inside server-rendered forms. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="native-select" className={cn(fieldBase, "h-9 py-1 pr-8", className)} {...props} />;
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm leading-none font-medium select-none", className)}
      {...props}
    />
  );
}

export { Input, Textarea, NativeSelect, Label };
