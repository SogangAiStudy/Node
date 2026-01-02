import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    const userId = 'cmjtac2na000294v4bane8o09';
    const orgId = 'cmjtzdrhv0002vnv4plovr6g1';

    const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId } }
    });

    console.log('Membership:', JSON.stringify(membership, null, 2));
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
