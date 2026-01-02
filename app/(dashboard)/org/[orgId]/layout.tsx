import { Sidebar } from "@/components/layout/Sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentOrgId={orgId} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
