"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Building2,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Clock,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("join");

  // Join Org State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string, name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  // Create Org State
  const [organizationName, setOrganizationName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Refresh status state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if user already has an organization and redirect
  const { data: workspaces, isLoading: isCheckingWorkspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ orgId: string; name: string; status: string; hasUnreadInbox: boolean }>>;
    },
    staleTime: 0,
  });

  const pendingOrg = workspaces?.find(w => w.status === "PENDING_APPROVAL");

  useEffect(() => {
    if (!isCheckingWorkspaces && workspaces && workspaces.length > 0) {
      const activeOrg = workspaces.find(w =>
        ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(w.status)
      );
      if (activeOrg) {
        router.push(`/org/${activeOrg.orgId}/projects`);
      }
    }
  }, [workspaces, isCheckingWorkspaces, router]);

  // Search logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.organizations);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Join request submitted! Wait for admin approval.");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.success(`${organizationName} created successfully!`);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push(`/org/${orgData.id}/projects`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    // Keep spin for at least 800ms for visual feedback
    setTimeout(() => setIsRefreshing(false), 800);
  };

  if (isCheckingWorkspaces) {
    return (
      <div className="min-h-screen bg-[#1a1b1e] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#d1d2d5] opacity-50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-[#d1d2d5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-white rounded-xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-white/5">
            <Building2 className="h-6 w-6 text-[#1a1b1e]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Setup Node</h1>
          <p className="text-[#7b7c7e] text-sm">Configure your workspace to start collaborating.</p>
        </div>

        <Card className="bg-[#2c2d31] border-[#37383d] shadow-2xl">
          <CardContent className="pt-6">
            {pendingOrg ? (
              <div className="py-6 text-center space-y-6">
                <div className="bg-[#37383d] w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-[#4a4b52]">
                  {isRefreshing ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : (
                    <Clock className="h-8 w-8 text-[#eb5757]" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Pending Approval</h3>
                  <p className="text-sm text-[#7b7c7e] px-4">
                    Your request to join <span className="font-semibold text-[#d1d2d5]">"{pendingOrg.name}"</span> is currently being reviewed.
                  </p>
                </div>

                <div className="pt-4 space-y-3 px-4">
                  <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="w-full h-11 bg-white text-[#1a1b1e] hover:bg-white/90 font-semibold rounded-lg"
                  >
                    {isRefreshing ? "Checking..." : "Refresh Status"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full h-11 text-[#7b7c7e] hover:text-white hover:bg-white/5"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#1a1b1e] p-1 rounded-lg mb-8">
                  <TabsTrigger
                    value="join"
                    className="data-[state=active]:bg-[#2c2d31] data-[state=active]:text-white rounded-md transition-all h-9"
                  >
                    Join Team
                  </TabsTrigger>
                  <TabsTrigger
                    value="create"
                    className="data-[state=active]:bg-[#2c2d31] data-[state=active]:text-white rounded-md transition-all h-9"
                  >
                    New Space
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="join" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-3">
                    <Label htmlFor="searchOrg" className="text-xs font-bold text-[#7b7c7e] uppercase tracking-wider ml-1">Search Organizations</Label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#7b7c7e]" />
                      <Input
                        id="searchOrg"
                        type="text"
                        placeholder="Organization name..."
                        className="h-11 pl-10 bg-[#1a1b1e] border-transparent focus:border-white/20 focus:ring-0 text-[#d1d2d5] rounded-lg"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 max-h-[240px] overflow-y-auto px-1">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-[#7b7c7e]" />
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((org) => (
                        <div
                          key={org.id}
                          className="flex items-center justify-between p-3.5 bg-[#1a1b1e] hover:bg-[#37383d] rounded-xl border border-transparent hover:border-white/10 transition-all group"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded-lg bg-[#2c2d31] flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {org.name[0]}
                            </div>
                            <span className="font-semibold text-sm truncate text-[#d1d2d5]">{org.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isSubmittingJoin}
                            onClick={() => handleJoinRequest(org.id)}
                            className="bg-white text-[#1a1b1e] hover:bg-white/90 h-8 px-4 font-bold text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Join
                          </Button>
                        </div>
                      ))
                    ) : searchQuery.length >= 2 ? (
                      <div className="text-center py-12 px-6">
                        <p className="text-sm text-[#7b7c7e]">No organizations found matching <span className="text-[#d1d2d5]">"{searchQuery}"</span></p>
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6 border-2 border-dashed border-[#37383d] rounded-2xl">
                        <UserPlus className="h-6 w-6 text-[#7b7c7e] mx-auto mb-3 opacity-20" />
                        <p className="text-xs text-[#7b7c7e]">Enter a team name to request access.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="create" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <form onSubmit={handleCreateOrganization} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="orgName" className="text-xs font-bold text-[#7b7c7e] uppercase tracking-wider ml-1">Workspace Name</Label>
                      <Input
                        id="orgName"
                        type="text"
                        placeholder="e.g. Acme Studio"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        required
                        disabled={isCreating}
                        className="h-11 bg-[#1a1b1e] border-transparent focus:border-white/20 focus:ring-0 text-[#d1d2d5] rounded-lg"
                      />
                      <p className="text-[11px] text-[#7b7c7e] italic px-1">
                        You can add teams and invite colleagues later.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 bg-white text-[#1a1b1e] hover:bg-white/90 font-bold rounded-lg transition-all"
                      disabled={isCreating || !organizationName.trim()}
                    >
                      {isCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>Create Workspace <ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between px-2">
          <p className="text-[11px] text-[#7b7c7e]">Signed in as {session?.user?.email}</p>
          {!pendingOrg && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[11px] text-[#7b7c7e] hover:text-white underline transition-colors"
            >
              Switch account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
