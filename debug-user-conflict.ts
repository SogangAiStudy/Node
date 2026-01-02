import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    const email = 'bin139271@gmail.com';
    const idToFind = 'cmjtac2na000294v4bane8o09';

    console.log('Searching for User by ID:', idToFind);
    const userById = await prisma.user.findUnique({ where: { id: idToFind } });
    console.log('User found by ID:', userById ? JSON.stringify(userById, null, 2) : 'NULL');

    console.log('Searching for User by Email:', email);
    const userByEmail = await prisma.user.findUnique({ where: { email: email } });
    console.log('User found by Email:', userByEmail ? JSON.stringify(userByEmail, null, 2) : 'NULL');
}

check().catch(console.error).finally(() => {
    prisma.$disconnect();
    pool.end();
});
