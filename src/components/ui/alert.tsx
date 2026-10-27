import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm flex gap-3 items-start [&>svg]:size-4 [&>svg]:mt-0.5 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "text-destructive bg-destructive/5 border-destructive/30",
      success: "text-success bg-success/5 border-success/30",
      info: "bg-accent text-accent-foreground border-primary/20",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
