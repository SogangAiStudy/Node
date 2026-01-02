import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const userId = 'cmjtac2na000294v4bane8o09';
    const orgId = 'cmjtac7cx000494v4n9jaxl9b';

    const memberships = await prisma.orgMember.findMany({
        where: { userId }
    });

    console.log('User memberships:', JSON.stringify(memberships, null, 2));

    const targetMembership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId } }
    });

    console.log('Target membership:', JSON.stringify(targetMembership, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
