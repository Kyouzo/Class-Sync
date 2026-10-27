import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <ShieldAlert className="text-destructive size-10" aria-hidden />
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">Your account does not have permission to view this page.</p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
