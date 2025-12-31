"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Building2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("join");

  // Join Org State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string, name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  // Create Org State
  const [organizationName, setOrganizationName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
      // For now, we don't redirect because they are still pending
      // You might want a "Pending Approval" state page later
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

      toast.success("Organization created successfully!");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Node</CardTitle>
          <CardDescription>
            Join an existing organization or create a new one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="join" className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Join
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Create
              </TabsTrigger>
            </TabsList>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="searchOrg">Search Organization</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="searchOrg"
                    type="text"
                    placeholder="Type organization name..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-1">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((org) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between p-3 hover:bg-accent rounded-sm transition-colors"
                    >
                      <span className="font-medium">{org.name}</span>
                      <Button
                        size="sm"
                        disabled={isSubmittingJoin}
                        onClick={() => handleJoinRequest(org.id)}
                      >
                        Request Access
                      </Button>
                    </div>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No organizations found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Start typing to search...
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    disabled={isCreating}
                  />
                  <p className="text-sm text-muted-foreground">
                    This will be your private workspace name.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isCreating || !organizationName.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    "Create Organization"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 rounded-lg bg-blue-50/50 p-4 border border-blue-100/50">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">How it works</h4>
            <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
              <li>Joining requires approval from an organization administrator.</li>
              <li>You'll be notified once access is granted and teams are assigned.</li>
              <li>Creating a new organization makes you the primary administrator.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
