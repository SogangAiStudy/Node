import { prisma } from './lib/db/prisma';

async function checkTeams() {
    const teams = await prisma.team.findMany({
        include: {
            organization: true,
        },
    });

    console.log(`Total teams: ${teams.length}\n`);
    teams.forEach((team: any) => {
        console.log(`Team: ${team.name}`);
        console.log(`  Organization: ${team.organization.name}`);
        console.log(`  ID: ${team.id}`);
        console.log('');
    });

    await prisma.$disconnect();
}

checkTeams().catch(console.error);
