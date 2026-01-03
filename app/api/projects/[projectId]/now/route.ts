
import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
    redirect(`/org/${await getOrgId(params.projectId)}/projects/${params.projectId}/graph`);
}

async function getOrgId(projectId: string) {
    // We could fetch this, but for simplicity/perf in this stub, 
    // we might need to rely on the URL or fetch it. 
    // Since this is a route handler, we can fetch.
    const { prisma } = await import('@/lib/db/prisma');
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true }
    });
    return project?.orgId || 'unknown'; // Fallback
}
