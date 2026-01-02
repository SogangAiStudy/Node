import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import ProfilePageClient from "./page-client";

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    // Get user's primary organization (owner or first membership)
    const userOrg = await prisma.organization.findFirst({
        where: {
            OR: [
                { ownerId: session.user.id },
                {
                    members: {
                        some: {
                            userId: session.user.id,
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
            { ownerId: session.user.id ? "asc" : "desc" },
            { createdAt: "asc" },
        ],
    });

    return (
        <ProfilePageClient
            user={session.user}
            organization={userOrg}
        />
    );
}
