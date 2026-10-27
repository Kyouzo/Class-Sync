import Link from "next/link";
import type { ReactNode } from "react";
import type { CourseStatus } from "@prisma/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-muted-foreground text-sm">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: CourseStatus }) {
  const variant = status === "PUBLISHED" ? "success" : status === "DRAFT" ? "warning" : "secondary";
  return <Badge variant={variant}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/** Renders trusted-format Markdown. react-markdown does not render raw HTML, so content cannot inject scripts. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none prose-pre:overflow-x-auto", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/** Link-based pagination that preserves other query parameters. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params = {},
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (p > 1) search.set("page", String(p));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)} rel="prev">
            <ChevronLeft aria-hidden /> Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden /> Previous
        </Button>
      )}
      <span className="text-muted-foreground px-2 text-sm" aria-current="page">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)} rel="next">
            Next <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}
