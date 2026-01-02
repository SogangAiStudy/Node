import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { isOrgPro } from "@/lib/subscription";
import BillingPageClient from "./page-client";

export default async function BillingPage({
    params,
}: {
    params: Promise<{ orgId: string }>;
}) {
    const user = await requireAuth();

    const { orgId } = await params;

    // Verify user is a member of this organization
    const org = await prisma.organization.findFirst({
        where: {
            id: orgId,
            OR: [
                { ownerId: user.id },
                {
                    members: {
                        some: {
                            userId: user.id,
                        },
                    },
                },
            ],
        },
        select: {
            id: true,
            stripeCustomerId: true,
        },
    });

    if (!org) {
        redirect("/");
    }

    const isPro = await isOrgPro(orgId);

    // Count nodes in this organization
    const nodeCount = await prisma.node.count({
        where: {
            project: {
                orgId,
            },
        },
    });

    return (
        <BillingPageClient
            orgId={org.id}
            isOrgPro={isPro}
            nodeCount={nodeCount}
            stripeCustomerId={org.stripeCustomerId}
        />
    );
}
