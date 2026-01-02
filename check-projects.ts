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
    console.log('Checking projects for orgId:', orgId);
    const projects = await prisma.project.findMany({
        where: { orgId },
        include: {
            _count: {
                select: { nodes: true }
            }
        }
    });

    console.log('Projects found:', JSON.stringify(projects, null, 2));

    for (const project of projects) {
        const nodes = await prisma.node.findMany({
            where: { projectId: project.id }
        });
        console.log(`Project ${project.name} (${project.id}) has ${nodes.length} nodes.`);
        if (nodes.length > 0) {
            console.log('Sample node position:', nodes[0].positionX, nodes[0].positionY);
        }
    }
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
