"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RequestDTO } from "@/types";
import { toast } from "sonner";
import { ExternalLink, Clock, Inbox as InboxIcon, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function RequestCard({
  request,
  onAction,
  orgId,
}: {
  request: RequestDTO;
  onAction: () => void;
  orgId: string;
}) {
  const router = useRouter();
  const [responseDraft, setResponseDraft] = useState(request.responseDraft || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateToNode = () => {
    router.push(`/org/${orgId}/projects/${request.projectId}/graph?nodeId=${request.linkedNodeId}`);
  };

  const handleRespond = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseDraft }),
      });
      if (!res.ok) throw new Error("Failed to respond");
      toast.success("Response saved");
      onAction();
    } catch (error) {
      toast.error("Failed to save response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/claim`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to claim");
      toast.success("Request claimed");
      onAction();
    } catch (error) {
      toast.error("Failed to claim request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseFinal: responseDraft }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Request approved");
      onAction();
    } catch (error) {
      toast.error("Failed to approve request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/archive`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Request archived");
      onAction();
    } catch (error) {
      toast.error("Failed to archive request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Request deleted");
      onAction();
    } catch (error) {
      toast.error("Failed to delete request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header row - Project, Node, Status */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={handleNavigateToNode}
            className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            {request.linkedNodeTitle}
            <ExternalLink className="h-3 w-3" />
          </button>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            From <span className="font-medium text-foreground">{request.fromUserName}</span>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(request.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={request.status === "APPROVED" ? "default" : "secondary"}>
            {request.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchive}>
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Question - Emphasized */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Question</p>
          <p className="text-sm font-medium">{request.question}</p>
        </div>

        {/* Response Section - Emphasized */}
        {request.status !== "CLOSED" && request.status !== "APPROVED" ? (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Your Response</p>
            <Textarea
              value={responseDraft}
              onChange={(e) => setResponseDraft(e.target.value)}
              placeholder="Type your response..."
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex gap-2 pt-1">
              {request.toTeam && !request.toUserId && (
                <Button size="sm" variant="outline" onClick={handleClaim} disabled={isLoading}>
                  Claim
                </Button>
              )}
              <Button size="sm" onClick={handleRespond} disabled={isLoading}>
                {request.status === "RESPONDED" ? "Update" : "Respond"}
              </Button>
              {request.status === "RESPONDED" && request.toUserId && (
                <Button size="sm" variant="default" onClick={handleApprove} disabled={isLoading}>
                  Approve
                </Button>
              )}
            </div>
          </div>
        ) : request.responseFinal ? (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Final Response</p>
            <p className="text-sm">{request.responseFinal}</p>
            {request.approvedByName && (
              <p className="text-xs text-muted-foreground mt-2">
                Approved by {request.approvedByName}
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function OrgInboxPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [activeTab, setActiveTab] = useState("mine");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["org-inbox", orgId, activeTab],
    queryFn: async () => {
      const mode = activeTab === "archived" ? "mine" : activeTab;
      const archived = activeTab === "archived";
      const res = await fetch(`/api/requests/org-inbox?orgId=${orgId}&mode=${mode}&archived=${archived}`);
      if (!res.ok) throw new Error("Failed to fetch inbox");
      return res.json() as Promise<{ requests: RequestDTO[] }>;
    },
  });

  // Mark inbox as seen when page loads
  useEffect(() => {
    const markSeen = async () => {
      try {
        await fetch(`/api/inbox/mark-seen?orgId=${orgId}`, { method: "POST" });
      } catch (error) {
        console.error("Failed to mark inbox as seen:", error);
      }
    };
    markSeen();
  }, [orgId]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inbox</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="mine">To Me</TabsTrigger>
          <TabsTrigger value="team">To My Team</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center text-muted-foreground">Loading...</div>
      ) : data?.requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No requests in this inbox</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.requests.map((request) => (
            <RequestCard key={request.id} request={request} onAction={refetch} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  );
}
