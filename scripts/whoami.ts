import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // Find the user who has "xavi" in their name or email or just the most recent one
    const user = await prisma.user.findFirst({
        orderBy: { createdAt: "desc" },
    });

    if (user) {
        console.log(JSON.stringify(user, null, 2));
    } else {
        console.log("No user found");
    }
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
