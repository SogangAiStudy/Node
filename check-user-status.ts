import { prisma } from "./lib/db/prisma";

async function main() {
    const email = "duruchi84@gmail.com";
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            orgMemberships: {
                include: {
                    organization: true
                }
            }
        }
    });

    if (!user) {
        console.log(`User ${email} not found`);
        return;
    }

    console.log(`User: ${user.name} (${user.email})`);
    user.orgMemberships.forEach(m => {
        console.log(`- Org: ${m.organization.name} [${m.orgId}] | Status: ${m.status} | Role: ${m.role}`);
    });
}

main()
    .catch(console.error)
    .finally(() => process.exit());
