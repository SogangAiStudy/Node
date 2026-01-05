import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    console.log("🚀 Starting database reset...");

    try {
        // Order matters for foreign key constraints, or we can use TRUNCATE ... CASCADE
        // We skip 'users', 'accounts', 'sessions', 'verification_tokens' to keep the user logged in
        const tables = [
            'notifications',
            'org_inbox_states',
            'activity_logs',
            'requests',
            'edges',
            'node_owners',
            'node_teams',
            'nodes',
            'project_invites',
            'project_members',
            'project_teams',
            'projects',
            'folders',
            'team_members',
            'teams',
            'org_members',
            'organizations',
        ];

        for (const table of tables) {
            console.log(`Clearing table: ${table}...`);
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
        }

        console.log("✅ Database reset complete!");
    } catch (error) {
        console.error("❌ Reset failed:", error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
