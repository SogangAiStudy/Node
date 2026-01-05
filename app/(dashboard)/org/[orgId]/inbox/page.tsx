"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Clock, Inbox as InboxIcon, MoreHorizontal, Bell, UserPlus, CheckCircle2, XCircle, Shield } from "lucide-react";
import { RequestDTO, NotificationDTO, ProjectInviteDTO, OrgMemberDTO, InboxItem } from "@/types";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function NotificationCard({
  notification,
  onAction,
}: {
  notification: NotificationDTO;
  onAction: () => void;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleRead = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      onAction();
    } catch (error) {
      toast.error("Failed to dismiss notification");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = () => {
    if (notification.entityId) {
      router.push(`/org/${notification.orgId}/graph?nodeId=${notification.entityId}`);
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case "NODE_UNBLOCKED":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "PROJECT_ASSIGNED":
        return <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      case "TEAM_ASSIGNED":
        return <UserPlus className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      case "NODE_ASSIGNED":
        return <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "NODE_UPDATED":
        return <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getBadgeColor = () => {
    switch (notification.type) {
      case "NODE_UNBLOCKED":
        return "bg-green-100 dark:bg-green-900/30";
      case "PROJECT_ASSIGNED":
      case "TEAM_ASSIGNED":
        return "bg-purple-100 dark:bg-purple-900/30";
      case "NODE_UPDATED":
        return "bg-amber-100 dark:bg-amber-900/30";
      default:
        return "bg-blue-100 dark:bg-blue-900/30";
    }
  };

  const borderCol = notification.targetType === "TEAM" ? "border-l-purple-500" : "border-l-blue-500";

  return (
    <Card className={`overflow-hidden border-l-4 ${borderCol} shadow-sm`}>
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="flex gap-3">
          <div className={`mt-1 ${getBadgeColor()} p-2 rounded-full`}>
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{notification.title}</h3>
              {notification.targetType === "TEAM" && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase tracking-wider text-purple-600 border-purple-200">Team</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                {notification.type.replace("_", " ")}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground">{new Date(notification.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {notification.entityId && (
            <Button size="sm" variant="ghost" onClick={handleNavigate}>
              View
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleRead} disabled={isLoading}>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InviteCard({
  invite,
  onAction,
}: {
  invite: ProjectInviteDTO;
  onAction: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleResponse = async (accept: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${invite.projectId}/invites/${invite.id}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) throw new Error("Failed to respond");
      toast.success(accept ? "Invite accepted" : "Invite declined");
      onAction();
    } catch (error) {
      toast.error("Failed to respond to invite");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-l-4 border-l-purple-500 shadow-sm">
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="flex gap-3">
          <div className="mt-1 bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
            <UserPlus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Project Invitation</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{invite.invitedByUserName}</span> invited you to join{" "}
              <span className="font-medium text-foreground">{invite.projectName}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Invite</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground">{new Date(invite.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleResponse(true)} disabled={isLoading}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleResponse(false)} disabled={isLoading}>
            Decline
          </Button>
        </div>
      </div>
    </Card>
  );
}

function JoinRequestCard({
  member,
  onAction,
}: {
  member: OrgMemberDTO;
  onAction: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (approve: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organizations/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: member.orgId,
          status: approve ? "ACTIVE" : "DEACTIVATED"
        }),
      });
      if (!res.ok) throw new Error("Failed to approve/decline");
      toast.success(approve ? "Member approved" : "Member declined");
      onAction();
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="flex gap-3">
          <div className="mt-1 bg-amber-100 dark:bg-amber-900/30 p-2 rounded-full">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Join Request</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{member.userName || member.userEmail}</span> wants to join the workspace.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Admin Approval</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground">{new Date(member.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleAction(true)} disabled={isLoading}>
            Approve
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAction(false)} disabled={isLoading}>
            Decline
          </Button>
        </div>
      </div>
    </Card>
  );
}

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
  const [activeTab, setActiveTab] = useState("me");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["org-inbox-unified", orgId, activeTab],
    queryFn: async () => {
      if (activeTab === "archived") {
        const res = await fetch(`/api/requests/org-inbox?orgId=${orgId}&mode=mine&archived=true`);
        if (!res.ok) throw new Error("Failed to fetch inbox");
        const json = await res.json();
        return { items: json.requests.map((r: any) => ({ type: "REQUEST", data: r })) };
      }

      const res = await fetch(`/api/inbox/unified?orgId=${orgId}`);
      if (!res.ok) throw new Error("Failed to fetch inbox");
      return res.json() as Promise<{ items: InboxItem[] }>;
    },
    refetchInterval: 10000,
  });

  // Client-side filtering for tabs
  const filteredItems = data?.items.filter((item: InboxItem) => {
    if (activeTab === "archived") return true; // Already filtered by API

    if (activeTab === "me") {
      if (item.type === "INVITE" || item.type === "JOIN_REQUEST") return true;
      if (item.type === "NOTIFICATION" && item.data.targetType === "USER") return true;
      if (item.type === "REQUEST" && !!item.data.toUserId) return true;
      return false;
    }

    if (activeTab === "team") {
      if (item.type === "NOTIFICATION" && item.data.targetType === "TEAM") return true;
      if (item.type === "REQUEST" && !!item.data.toTeam) return true;
      return false;
    }

    return true;
  }) || [];

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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Inbox</h1>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {data?.items.length || 0} ITEMS
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="me" className="data-[state=active]:bg-background">To Me</TabsTrigger>
          <TabsTrigger value="team">To My Team</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <div className="h-8 w-8 bg-muted rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center text-muted-foreground">
            <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nothing here yet</p>
            <p className="text-sm max-w-[200px] mx-auto">
              {activeTab === "me" ? "Your personal updates will appear here." :
                activeTab === "team" ? "Updates for your teams will appear here." :
                  "Archived items will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item: InboxItem) => {
            if (item.type === "REQUEST") {
              return <RequestCard key={item.data.id} request={item.data} onAction={refetch} orgId={orgId} />;
            }
            if (item.type === "NOTIFICATION") {
              return <NotificationCard key={item.data.id} notification={item.data} onAction={refetch} />;
            }
            if (item.type === "INVITE") {
              return <InviteCard key={item.data.id} invite={item.data} onAction={refetch} />;
            }
            if (item.type === "JOIN_REQUEST") {
              return <JoinRequestCard key={item.data.id} member={item.data} onAction={refetch} />;
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
