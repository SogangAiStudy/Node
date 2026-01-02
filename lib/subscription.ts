import { prisma } from "@/lib/db/prisma";

const FREE_NODE_LIMIT = 20;

/**
 * Check if an organization has an active subscription (Pro tier)
 */
export async function isOrgPro(orgId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
            stripeSubscriptionStatus: true,
            stripeCurrentPeriodEnd: true,
        },
    });

    if (!org) return false;

    const validStatuses = ["active", "trialing"];
    const hasValidStatus =
        org.stripeSubscriptionStatus &&
        validStatuses.includes(org.stripeSubscriptionStatus);

    const isNotExpired =
        !org.stripeCurrentPeriodEnd ||
        org.stripeCurrentPeriodEnd.getTime() > Date.now();

    return hasValidStatus && isNotExpired;
}

/**
 * Check if an organization can create a new node
 * @throws Error if limit is exceeded
 */
export async function assertWithinNodeLimit(orgId: string): Promise<void> {
    const isPro = await isOrgPro(orgId);

    if (isPro) {
        // Pro users have unlimited nodes
        return;
    }

    // For free tier, check nodeCount
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { nodeCount: true },
    });

    if (!org) {
        throw new Error("Organization not found");
    }

    if (org.nodeCount >= FREE_NODE_LIMIT) {
        throw new Error(
            `Free tier limit reached. You can create up to ${FREE_NODE_LIMIT} nodes. Please upgrade to continue.`
        );
    }
}

/**
 * Check if an organization has reached the node limit
 * @returns true if limit is reached, false otherwise
 */
export async function hasReachedNodeLimit(orgId: string): Promise<boolean> {
    const isPro = await isOrgPro(orgId);

    if (isPro) {
        return false;
    }

    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { nodeCount: true },
    });

    if (!org) {
        return true;
    }

    return org.nodeCount >= FREE_NODE_LIMIT;
}
