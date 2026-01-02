import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { isOrgPro } from "@/lib/subscription";
import BillingPageClient from "./page-client";

export default async function BillingPage({
    params,
}: {
    params: Promise<{ orgId: string }>;
}) {
    const session = await auth();
    if (!session?.id) {
        redirect("/");
    }

    const { orgId } = await params;

    // Verify user is a member of this organization
    const org = await prisma.organization.findFirst({
        where: {
            id: orgId,
            OR: [
                { ownerId: session.id },
                {
                    members: {
                        some: {
                            userId: session.id,
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

    return (
        <BillingPageClient
            orgId={org.id}
            isOrgPro={isPro}
            stripeCustomerId={org.stripeCustomerId}
        />
    );
}
