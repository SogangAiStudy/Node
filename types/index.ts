import {
  NodeType,
  ManualStatus,
  EdgeRelation,
  RequestStatus,
  OrgRole,
  OrgMemberStatus,
  TeamRole,
  ProjectRole,
} from "@prisma/client";

// Export Prisma types for convenience
export {
  type NodeType,
  type ManualStatus,
  type EdgeRelation,
  type RequestStatus,
  type OrgRole,
  type OrgMemberStatus,
  type TeamRole,
  type ProjectRole,
};

// Computed status (derived from graph state)
export type ComputedStatus = "BLOCKED" | "WAITING" | "TODO" | "DOING" | "DONE";

// ============================================================================
// ORGANIZATION & TEAM DTOs
// ============================================================================

// Organization DTO
export interface OrganizationDTO {
  id: string;
  name: string;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  teamCount?: number;
  projectCount?: number;
}

// Organization Member DTO
export interface OrgMemberDTO {
  id: string;
  orgId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  role: OrgRole;
  status: OrgMemberStatus;
  createdAt: string;
  teamCount?: number;
}

// Team DTO
export interface TeamDTO {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount?: number;
  projectCount?: number;
}

// Team Member DTO
export interface TeamMemberDTO {
  id: string;
  orgId: string;
  teamId: string;
  teamName?: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  role: TeamRole;
  createdAt: string;
}

// Project Team DTO (team access to project)
export interface ProjectTeamDTO {
  id: string;
  orgId: string;
  projectId: string;
  teamId: string;
  teamName: string;
  role: ProjectRole;
  createdAt: string;
  memberCount?: number;
}

// ============================================================================
// PROJECT & GRAPH DTOs
// ============================================================================

// Node DTO with computed status
export interface NodeDTO {
  id: string;
  orgId: string;
  projectId: string;
  teamId: string | null;
  teamName: string | null;
  title: string;
  description: string | null;
  type: NodeType;
  manualStatus: ManualStatus;
  computedStatus: ComputedStatus; // Computed on server
  ownerId: string | null;
  ownerName: string | null;
  priority: number;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Edge DTO
export interface EdgeDTO {
  id: string;
  orgId: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EdgeRelation;
  createdAt: string;
}

// Request DTO
export interface RequestDTO {
  id: string;
  orgId: string;
  projectId: string;
  linkedNodeId: string;
  linkedNodeTitle: string;
  question: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string | null;
  toUserName: string | null;
  toTeam: string | null;
  status: RequestStatus;
  responseDraft: string | null;
  responseFinal: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Graph data response
export interface GraphData {
  nodes: NodeDTO[];
  edges: EdgeDTO[];
}

// Now view data
export interface NowData {
  myTodos: NodeDTO[];
  myWaiting: NodeDTO[];
  imBlocking: Array<{
    blockedNode: NodeDTO;
    waitingOnMyNode: NodeDTO;
  }>;
}

// Project DTO
export interface ProjectDTO {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  primaryTeamId: string | null;
  primaryTeamName: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount?: number; // Deprecated - use teamCount
  teamCount?: number; // Number of teams with access
  userRole?: ProjectRole | null; // Current user's role in the project
}

// API Error response
export interface ApiError {
  error: string;
  details?: unknown;
}

// Activity log entry
export interface ActivityLogEntry {
  id: string;
  orgId: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}
