import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

interface InvitePageProps {
    params: {
        code: string;
    };
}

export default async function InvitePage({ params }: InvitePageProps) {
    const { code } = params;
    const session = await auth();

    // If not logged in, redirect to login with return URL
    if (!session?.user?.id) {
        return redirect(`/auth/signin?callbackUrl=/invite/${code}`);
    }

    // Find organization by invite code
    const organization = await prisma.organization.findUnique({
        where: { inviteCode: code },
        include: {
            members: {
                where: { userId: session.user.id },
            },
        },
    });

    // Invalid invite code
    if (!organization) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
                <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-sm border border-[#e9e9e9] text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">❌</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#1a1b1e] mb-2">Invalid Invitation</h1>
                    <p className="text-[#7b7c7e] mb-6">
                        This invitation link is invalid or has expired.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-2 bg-[#1a1b1e] text-white rounded-lg hover:bg-[#37352f] transition-colors"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // Already a member
    if (organization.members.length > 0) {
        return redirect(`/org/${organization.id}/projects`);
    }

    // Add user as member
    try {
        await prisma.orgMember.create({
            data: {
                userId: session.user.id,
                orgId: organization.id,
                role: "MEMBER",
                status: "ACTIVE",
            },
        });

        // Success - redirect to organization
        return redirect(`/org/${organization.id}/projects?welcome=1`);
    } catch (error) {
        console.error("Error adding member:", error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
                <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-sm border border-[#e9e9e9] text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#1a1b1e] mb-2">Error Joining Workspace</h1>
                    <p className="text-[#7b7c7e] mb-6">
                        There was an error adding you to the workspace. Please try again or contact support.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-2 bg-[#1a1b1e] text-white rounded-lg hover:bg-[#37352f] transition-colors"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        );
    }
}
