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
import { ExternalLink, Clock, Inbox as InboxIcon } from "lucide-react";

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

  const handleClose = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/close`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to close");
      toast.success("Request closed");
      onAction();
    } catch (error) {
      toast.error("Failed to close request");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{request.question}</CardTitle>
          <Badge>{request.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            From: <span className="font-medium">{request.fromUserName}</span>
          </p>
          <button
            onClick={handleNavigateToNode}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span>Node:</span>
            <span className="font-medium text-primary group-hover:underline">
              {request.linkedNodeTitle}
            </span>
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          {request.toTeam && !request.toUserId && (
            <p className="text-muted-foreground">
              To Team: <span className="font-medium">{request.toTeam}</span>
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Created {new Date(request.createdAt).toLocaleDateString()}
            </span>
            {request.updatedAt !== request.createdAt && (
              <span className="flex items-center gap-1">
                Updated {new Date(request.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {request.status !== "CLOSED" && request.status !== "APPROVED" && (
          <div className="space-y-2">
            <Textarea
              value={responseDraft}
              onChange={(e) => setResponseDraft(e.target.value)}
              placeholder="Type your response..."
              rows={3}
            />
            <div className="flex gap-2">
              {request.toTeam && !request.toUserId && (
                <Button size="sm" onClick={handleClaim} disabled={isLoading}>
                  Claim
                </Button>
              )}
              <Button size="sm" onClick={handleRespond} disabled={isLoading}>
                {request.status === "RESPONDED" ? "Update Response" : "Respond"}
              </Button>
              {request.status === "RESPONDED" && request.toUserId && (
                <Button size="sm" onClick={handleApprove} disabled={isLoading}>
                  Approve
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleClose} disabled={isLoading}>
                Close
              </Button>
            </div>
          </div>
        )}

        {request.responseFinal && (
          <div className="rounded bg-muted p-3">
            <p className="text-sm font-medium mb-1">Final Response:</p>
            <p className="text-sm">{request.responseFinal}</p>
            {request.approvedByName && (
              <p className="text-xs text-muted-foreground mt-2">
                Approved by {request.approvedByName}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrgInboxPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [mode, setMode] = useState<"mine" | "team">("mine");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["org-inbox", orgId, mode],
    queryFn: async () => {
      const res = await fetch(`/api/requests/org-inbox?orgId=${orgId}&mode=${mode}`);
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

      <Tabs value={mode} onValueChange={(v) => setMode(v as "mine" | "team")}>
        <TabsList>
          <TabsTrigger value="mine">To Me</TabsTrigger>
          <TabsTrigger value="team">To My Team</TabsTrigger>
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
