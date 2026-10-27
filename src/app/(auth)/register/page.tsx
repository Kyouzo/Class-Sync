import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FormField } from "@/components/form-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>New accounts are student accounts. An administrator can grant instructor access.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={registerAction} className="grid gap-4" aria-label="Create account">
          <FormField id="name" label="Full name">
            <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
          </FormField>
          <FormField id="email" label="Email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <FormField id="password" label="Password" hint="At least 8 characters.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
          </FormField>
          <FormField id="confirmPassword" label="Confirm password">
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
          </FormField>
          <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
        </ActionForm>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
