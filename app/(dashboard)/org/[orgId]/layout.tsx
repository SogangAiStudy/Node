import { Sidebar } from "@/components/layout/Sidebar";

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orgId: string };
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar currentOrgId={params.orgId} />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1200px] mx-auto px-8 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
