import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const nodes = await prisma.node.findMany({
        where: { projectId: "onboarding-project-id" },
        select: {
            id: true,
            title: true,
            positionX: true,
            positionY: true,
        },
        orderBy: { id: "asc" },
    });

    console.log(JSON.stringify(nodes, null, 2));
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
