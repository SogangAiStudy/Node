"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Navbar({ user }: NavbarProps) {
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  // Fetch user's organization status
  const { data: orgStatus } = useQuery({
    queryKey: ["organization-status"],
    queryFn: async () => {
      const res = await fetch("/api/user/organization-status");
      if (!res.ok) return null;
      return res.json() as Promise<{
        hasOrganization: boolean;
        organization: {
          id: string;
          name: string;
          role: string;
          status: string;
        } | null;
      }>;
    },
  });

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              Node
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Projects
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>

                <DropdownMenuSeparator />

                {orgStatus?.hasOrganization && orgStatus.organization ? (
                  <>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Organization</p>
                      <p className="text-sm font-medium">{orgStatus.organization.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {orgStatus.organization.role}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          {orgStatus.organization.status}
                        </span>
                      </div>
                    </div>
                    {orgStatus.organization.role === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link href="/organization/members" className="cursor-pointer">
                          Teams & Members
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground">No organization</p>
                  </div>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="cursor-pointer"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
