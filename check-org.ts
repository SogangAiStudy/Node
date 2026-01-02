import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    const orgId = 'cmjtac7cx000494v4n9jaxl9b';
    console.log('Checking for OrgId:', orgId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    console.log('Org found:', JSON.stringify(org, null, 2));
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
