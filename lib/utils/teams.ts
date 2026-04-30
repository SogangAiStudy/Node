import { prisma } from "@/lib/db/prisma";

/**
 * Assigns a user to the default team of an organization.
 * If the team doesn't exist, it creates one.
 */
export async function assignToDefaultTeam(orgId: string, userId: string) {
    try {
        // 1. Find or create the canonical default team.
        let defaultTeam = await prisma.team.findFirst({
            where: {
                orgId,
                isDefault: true,
            }
        });

        if (!defaultTeam) {
            defaultTeam = await prisma.team.create({
                data: {
                    orgId,
                    name: "Default Team",
                    description: "Automatic default team for all new members.",
                    isDefault: true,
                }
            });
        }

        // 2. Check if user is already a member
        const existingMembership = await prisma.teamMember.findUnique({
            where: {
                orgId_teamId_userId: {
                    orgId,
                    teamId: defaultTeam.id,
                    userId
                }
            }
        });

        if (!existingMembership) {
            // 3. Add user to the team
            await prisma.teamMember.create({
                data: {
                    orgId,
                    teamId: defaultTeam.id,
                    userId,
                    role: "MEMBER"
                }
            });
            console.log(`User ${userId} assigned to Default Team in org ${orgId}`);
        }

        return defaultTeam;
    } catch (error) {
        console.error("Error in assignToDefaultTeam:", error);
        throw error;
    }
}
