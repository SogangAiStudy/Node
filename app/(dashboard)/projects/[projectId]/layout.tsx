"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.projectId as string;

  const currentTab = pathname.includes("/now")
    ? "now"
    : pathname.includes("/graph")
      ? "graph"
      : pathname.includes("/inbox")
        ? "inbox"
        : "now";

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs value={currentTab} className="mb-6">
        <TabsList>
          <Link href={`/projects/${projectId}/now`}>
            <TabsTrigger value="now">Now</TabsTrigger>
          </Link>
          <Link href={`/projects/${projectId}/graph`}>
            <TabsTrigger value="graph">Graph</TabsTrigger>
          </Link>
          <Link href={`/projects/${projectId}/inbox`}>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
          </Link>
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
