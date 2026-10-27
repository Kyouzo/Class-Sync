import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist or is not available to you.</p>
      <Button asChild className="mt-2">
        <Link href="/courses">Browse courses</Link>
      </Button>
    </div>
  );
}
