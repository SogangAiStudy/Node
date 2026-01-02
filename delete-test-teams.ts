import { prisma } from './lib/db/prisma';

async function deleteTestTeams() {
    // 모든 팀 삭제 (사용자의 개인 조직 제외)
    const deletedTeams = await prisma.team.deleteMany({
        where: {
            name: {
                in: ['All-sogang', 'zrbs', 'Default Team', 'Dcog', 'SW']
            }
        }
    });

    console.log(`Deleted ${deletedTeams.count} test teams`);

    await prisma.$disconnect();
}

deleteTestTeams().catch(console.error);
