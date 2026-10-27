"use client";

import Link from "next/link";
import { Award, ChartColumn, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/actions/auth";

export type NavLink = { href: string; label: string };

export function UserMenu({ user, links }: { user: { name: string; email: string; role: string }; links: NavLink[] }) {
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Open account menu" className="gap-2">
          <Menu className="md:hidden" aria-hidden />
          <span className="bg-primary text-primary-foreground hidden size-6 items-center justify-center rounded-full text-[11px] md:flex" aria-hidden>
            {initials}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          <p className="text-muted-foreground mt-1 text-xs capitalize">{user.role.toLowerCase()}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="md:hidden">
          {links.map((link) => (
            <DropdownMenuItem key={link.href} asChild>
              <Link href={link.href}>{link.label}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
        </div>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/grades">
            <ChartColumn aria-hidden /> My grades
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/certificates">
            <Award aria-hidden /> Certificates
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
