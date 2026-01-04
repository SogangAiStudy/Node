import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { isOrgPro } from "@/lib/subscription";
import BillingPageClient from "./page-client";

export default async function BillingPage({
    params,
    searchParams,
}: {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ session_id?: string; success?: string }>;
}) {
    const user = await requireAuth();
    const { orgId } = await params;
    const { session_id, success } = await searchParams;

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

    // If session_id is present, verify the session (client will handle via API)
    const shouldVerifySession = !!session_id;

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
            sessionId={session_id}
            showSuccess={success === "1" || shouldVerifySession}
        />
    );
}
