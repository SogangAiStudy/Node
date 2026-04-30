import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";

export default async function LegacyOrganizationMembersPage() {
    const user = await requireAuth();

    const membership = await prisma.orgMember.findFirst({
        where: {
            userId: user.id,
            status: {
                in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"],
            },
        },
        orderBy: {
            createdAt: "asc",
        },
        select: {
            orgId: true,
        },
    });

    if (!membership) {
        redirect("/");
    }

    redirect(`/org/${membership.orgId}/settings?tab=members`);
}
