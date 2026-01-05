import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const users = await prisma.user.findMany({
        where: {
            NOT: {
                email: {
                    endsWith: "@node.ai"
                }
            }
        }
    });

    const userIds = users.map(u => u.id);

    if (userIds.length > 0) {
        console.log(`Resetting memberships for users: ${userIds.join(", ")}`);

        await prisma.orgMember.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.projectMember.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.teamMember.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.nodeOwner.deleteMany({
            where: { userId: { in: userIds } }
        });

        await prisma.orgInboxState.deleteMany({
            where: { userId: { in: userIds } }
        });

        console.log("Done.");
    } else {
        console.log("No real users found to reset.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
