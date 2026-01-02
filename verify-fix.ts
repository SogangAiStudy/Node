import { prisma } from "./lib/db/prisma";

async function main() {
    const userEmail = "inmunplusai@gmail.com";
    const user = await prisma.user.findUnique({
        where: { email: userEmail }
    });

    if (!user) {
        console.log("User not found");
        return;
    }

    console.log(`\n--- Simulating /api/workspaces for ${user.email} ---`);

    const orgMemberships = await prisma.orgMember.findMany({
        where: {
            userId: user.id,
            status: {
                in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"],
            },
        },
        include: {
            organization: true
        }
    });

    console.log(`Found ${orgMemberships.length} memberships`);
    for (const m of orgMemberships) {
        console.log(`- Org: ${m.organization.name} [ID: ${m.orgId}] | Status: ${m.status}`);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit());
