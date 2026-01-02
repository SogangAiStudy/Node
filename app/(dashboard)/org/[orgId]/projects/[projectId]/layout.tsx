"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const currentTab = pathname.includes("/now")
    ? "now"
    : pathname.includes("/graph")
      ? "graph"
      : "graph";

  return (
    <div className="space-y-6">
      <Tabs value={currentTab}>
        <TabsList>
          <Link href={`/org/${orgId}/projects/${projectId}/now`}>
            <TabsTrigger value="now">Now</TabsTrigger>
          </Link>
          <Link href={`/org/${orgId}/projects/${projectId}/graph`}>
            <TabsTrigger value="graph">Graph</TabsTrigger>
          </Link>
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
