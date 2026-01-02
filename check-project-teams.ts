import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    const orgId = 'cmjtzdrhv0002vnv4plovr6g1';
    const projects = await prisma.project.findMany({
        where: { orgId }
    });

    for (const project of projects) {
        const pts = await prisma.projectTeam.findMany({
            where: { projectId: project.id }
        });
        console.log(`Project ${project.name} (${project.id}) has ${pts.length} ProjectTeam entries.`);
    }
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
