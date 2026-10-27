import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ClassSync", template: "%s · ClassSync" },
  description: "ClassSync is an open-source learning management system for courses, quizzes, progress tracking and certificates.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="bg-primary text-primary-foreground sr-only z-50 rounded px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="text-muted-foreground border-t py-6 text-center text-sm">
          ClassSync · open-source learning management · built with Next.js, Prisma and PostgreSQL
        </footer>
      </body>
    </html>
  );
}
