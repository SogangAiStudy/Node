import { Prisma } from "@prisma/client";
import { RequestDTO } from "@/types";

export const requestDetailsInclude = {
  linkedNode: {
    select: { title: true },
  },
  fromUser: {
    select: { name: true },
  },
  toUser: {
    select: { name: true },
  },
  approvedBy: {
    select: { name: true },
  },
  targetTeam: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.RequestInclude;

export function buildTeamRequestFilters(teamIds: string[], teamNames: string[] = []): Prisma.RequestWhereInput[] {
  const filters: Prisma.RequestWhereInput[] = [];

  if (teamIds.length > 0) {
    filters.push({ targetTeamId: { in: teamIds } });
  }

  if (teamNames.length > 0) {
    filters.push({ toTeam: { in: teamNames } });
  }

  return filters;
}

export function getRequestTeamName(request: {
  toTeam?: string | null;
  targetTeam?: { name: string } | null;
}) {
  return request.targetTeam?.name ?? request.toTeam ?? null;
}

type RequestForDTO = Prisma.RequestGetPayload<{ include: typeof requestDetailsInclude }> & {
  linkedNodeTitle?: string | null;
  fromUserName?: string | null;
  toUserName?: string | null;
  approvedByName?: string | null;
};

export function toRequestDTO(request: RequestForDTO): RequestDTO {
  const toTeamName = getRequestTeamName(request);

  return {
    id: request.id,
    orgId: request.orgId,
    projectId: request.projectId,
    linkedNodeId: request.linkedNodeId,
    linkedNodeTitle: request.linkedNode?.title ?? request.linkedNodeTitle ?? "",
    question: request.question,
    fromUserId: request.fromUserId,
    fromUserName: request.fromUser?.name || request.fromUserName || "Unknown",
    toUserId: request.toUserId,
    toUserName: request.toUser?.name || request.toUserName || null,
    targetTeamId: request.targetTeamId ?? request.targetTeam?.id ?? null,
    toTeamName,
    toTeam: toTeamName,
    status: request.status,
    responseDraft: request.responseDraft,
    responseFinal: request.responseFinal,
    approvedById: request.approvedById,
    approvedByName: request.approvedBy?.name || request.approvedByName || null,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    claimedAt: request.claimedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
