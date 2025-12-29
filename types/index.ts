import { NodeType, ManualStatus, EdgeRelation, RequestStatus } from "@prisma/client";

// Computed status (derived from graph state)
export type ComputedStatus = "BLOCKED" | "WAITING" | "TODO" | "DOING" | "DONE";

// Node DTO with computed status
export interface NodeDTO {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  type: NodeType;
  manualStatus: ManualStatus;
  computedStatus: ComputedStatus; // Computed on server
  ownerId: string | null;
  ownerName: string | null;
  team: string | null;
  priority: number;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Edge DTO
export interface EdgeDTO {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: EdgeRelation;
  createdAt: string;
}

// Request DTO
export interface RequestDTO {
  id: string;
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
  name: string;
  createdAt: string;
  memberCount: number;
}

// API Error response
export interface ApiError {
  error: string;
  details?: unknown;
}

// Activity log entry
export interface ActivityLogEntry {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}
