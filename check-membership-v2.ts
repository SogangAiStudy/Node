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
    const orgId = 'cmjtac7cx000494v4n9jaxl9b';

    console.log('Checking for UserId:', userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log('User found:', !!user);

    console.log('Checking for OrgMemberships for userId:', userId);
    const memberships = await prisma.orgMember.findMany({ where: { userId } });
    console.log('Memberships:', JSON.stringify(memberships, null, 2));
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
