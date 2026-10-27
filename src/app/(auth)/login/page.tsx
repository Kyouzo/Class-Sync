import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { firstParam } from "@/lib/utils";
import { loginAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const callbackUrl = firstParam((await searchParams).callbackUrl) ?? "/dashboard";
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>Welcome back to ClassSync.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={loginAction} className="grid gap-4" aria-label="Sign in">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField id="password" label="Password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </FormField>
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        </ActionForm>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          New to ClassSync?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
