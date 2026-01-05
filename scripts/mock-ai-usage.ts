import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Find a user to test with (excluding the bot)
        const user = await prisma.user.findFirst({
            where: { email: { not: "assistant@node.ai" } }
        });

        if (!user) {
            console.log("No user found to mock activity for.");
            return;
        }

        console.log(`Mocking 4 AI generations for user: ${user.email}...`);

        // Create 4 plan generation logs
        for (let i = 0; i < 4; i++) {
            await prisma.activityLog.create({
                data: {
                    projectId: "onboarding-project-id",
                    orgId: "demo-org-id",
                    userId: user.id,
                    action: "GENERATE_PLAN",
                    entityType: "PROJECT",
                    entityId: "onboarding-project-id",
                    details: { mock: true },
                },
            });
        }

        console.log("✅ Mocking complete. User should have 1 generation left today.");
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
