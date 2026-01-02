import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    const newId = 'cmjtac2na000294v4bane8o09';
    const oldId = 'cmjtzdjow0000vnv4nlmmp75a';

    console.log('Checking OrgMembers for newId:', newId);
    const newMembers = await prisma.orgMember.findMany({ where: { userId: newId } });
    console.log('New ID Memberships count:', newMembers.length);

    console.log('Checking OrgMembers for oldId:', oldId);
    const oldMembers = await prisma.orgMember.findMany({ where: { userId: oldId } });
    console.log('Old ID Memberships count:', oldMembers.length);

    if (oldMembers.length > 0) {
        console.log('Old ID has data! Attempting to move furniture...');
        // We can't easily update FKs if they are strictly enforced and not cascading.
        // Instead, we might need to delete the NEW user and revert to the OLD ID.
    }
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
