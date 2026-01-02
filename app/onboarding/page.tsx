"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Laptop, Search, Plus, UserPlus, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("create");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["org-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];
      const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.organizations as Array<{ id: string; name: string }>;
    },
    enabled: searchQuery.length >= 2,
  });

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationName) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organizationName,
          createDefaultTeam: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }
      const orgData = await res.json();
      toast.success("Organization created successfully!");
      // Invalidate both workspace and status queries
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["organization-status"] });

      router.push(`/org/${orgData.organization.id}/projects`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRequest = async (orgId: string) => {
    setIsSubmittingJoin(true);
    try {
      const res = await fetch("/api/organizations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit join request");
      }

      toast.success("Join request submitted!");
      setActiveTab("pending");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-[480px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#37352f] text-white shadow-xl shadow-black/10 mb-4 ring-4 ring-white">
            <Laptop className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold text-[#1a1b1e] tracking-tight">Setup Workspace</h1>
          <p className="text-[#7b7c7e] text-lg leading-relaxed">Create a private space or join a shared organization.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-[#f1f1ef] rounded-xl border border-[#e1e1de]">
            <TabsTrigger value="create" className="rounded-lg font-bold text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1a1b1e]">
              <Plus className="w-4 h-4 mr-2" /> Create
            </TabsTrigger>
            <TabsTrigger value="join" className="rounded-lg font-bold text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1a1b1e]">
              <UserPlus className="w-4 h-4 mr-2" /> Join
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-0">
            <Card className="border-none shadow-2xl shadow-black/5 rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-[#7b7c7e] uppercase tracking-widest ml-1">Workspace Name</label>
                    <Input
                      placeholder="Acme Corp, Personal Space, etc."
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="h-14 text-lg border-none bg-[#f7f7f5] focus-visible:ring-0 focus-visible:bg-[#f1f1ef] transition-all rounded-2xl px-5"
                      disabled={isCreating}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateOrganization}
                  disabled={!organizationName || isCreating}
                  className="w-full h-14 rounded-2xl bg-[#37352f] hover:bg-[#1a1b1e] text-white font-bold text-lg shadow-xl shadow-[#37352f]/20 transition-all active:scale-95 disabled:opacity-30"
                >
                  {isCreating ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                  ) : (
                    <Sparkles className="w-5 h-5 mr-3" />
                  )}
                  Launch Workspace
                </Button>
                <p className="text-[11px] text-center text-[#7b7c7e] leading-relaxed">
                  By creating a workspace, you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join" className="mt-0">
            <Card className="border-none shadow-2xl shadow-black/5 rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7b7c7e]" />
                    <Input
                      placeholder="Search by name..."
                      className="pl-11 h-12 border-none bg-[#f7f7f5] focus-visible:ring-0 focus-visible:bg-[#f1f1ef] transition-all rounded-xl text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar pr-1 -mr-1">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-widest">Searching...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 bg-[#fbfbfa] hover:bg-[#f1f1ef] rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#e1e1de] shadow-sm">
                            <Building2 className="w-5 h-5 text-[#37352f]" />
                          </div>
                          <span className="font-bold text-[#1a1b1e] truncate pr-4">{org.name}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg h-9 px-4 font-bold text-[11px] uppercase tracking-widest hover:bg-[#37352f] hover:text-white transition-all shrink-0"
                          disabled={isSubmittingJoin}
                          onClick={() => handleJoinRequest(org.id)}
                        >
                          Join
                        </Button>
                      </div>
                    ))
                  ) : searchQuery.length >= 2 ? (
                    <div className="text-center py-12 text-[#7b7c7e] space-y-2 opacity-60">
                      <p className="text-sm font-medium">No results for "{searchQuery}"</p>
                      <p className="text-xs uppercase tracking-widest font-bold">Try another name</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-[#7b7c7e] space-y-2 opacity-60">
                      <p className="text-xs uppercase tracking-widest font-bold">Search above to find teams</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-0">
            <Card className="border-none shadow-2xl shadow-black/5 rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-12 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-500 mb-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-[#1a1b1e]">Access Pending</h3>
                  <p className="text-[#7b7c7e] text-sm leading-relaxed">
                    Your request has been sent to the admins. You'll be notified once access is granted.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-[#e1e1de] h-11 px-6 font-bold text-xs uppercase tracking-widest"
                  onClick={() => setActiveTab("create")}
                >
                  Create another workspace
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
