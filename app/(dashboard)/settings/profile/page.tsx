import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import ProfilePageClient from "./page-client";

export default async function ProfilePage() {
    const user = await requireAuth();

    // Get user's primary organization (owner or first membership)
    const userOrg = await prisma.organization.findFirst({
        where: {
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
            name: true,
            stripeSubscriptionStatus: true,
            stripeCurrentPeriodEnd: true,
        },
        orderBy: [
            { ownerId: user.id ? "asc" : "desc" },
            { createdAt: "asc" },
        ],
    });

    return (
        <ProfilePageClient
            user={user}
            organization={userOrg}
        />
    );
}
