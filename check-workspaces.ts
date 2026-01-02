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

    console.log('Checking workspaces for user:', userId);
    const memberships = await prisma.orgMember.findMany({
        where: { userId },
        include: { organization: true }
    });

    console.log('Memberships:', memberships.map(m => ({
        orgId: m.orgId,
        name: m.organization.name,
        status: m.status
    })));

    if (memberships.length === 0) {
        console.log('NO WORKSPACES FOUND! This would trigger auto-provisioning.');
    } else {
        console.log('User has valid workspaces to redirect to.');
    }

    const teams = await prisma.teamMember.findMany({
        where: { userId, orgId: memberships[0]?.orgId }
    });
    console.log('Teams for first org:', teams.length);
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
