import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NodeDTO, GraphData, ManualStatus } from "@/types";
import { toast } from "sonner";

interface UpdateNodePayload {
    nodeId: string;
    projectId: string;
    updates: Partial<NodeDTO> & { ownerIds?: string[] };
}

export const useUpdateNode = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ nodeId, updates }: UpdateNodePayload) => {
            const res = await fetch(`/api/nodes/${nodeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to update node");
            }
            return res.json();
        },
        onMutate: async ({ nodeId, projectId, updates }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ["graph", projectId] });

            // Snapshot the previous value
            const previousGraphData = queryClient.getQueryData<GraphData>(["graph", projectId]);

            // Optimistically update to the new value
            if (previousGraphData) {
                queryClient.setQueryData<GraphData>(["graph", projectId], {
                    ...previousGraphData,
                    nodes: previousGraphData.nodes.map((n) => {
                        if (n.id === nodeId) {
                            const updatedNode = { ...n, ...updates };

                            // If manualStatus is updated, optimistically update computedStatus too
                            // so visual feedback (badges, colors) is instant.
                            if (updates.manualStatus) {
                                (updatedNode as any).computedStatus = updates.manualStatus;
                            }

                            return updatedNode;
                        }
                        return n;
                    }),
                });
            }

            return { previousGraphData };
        },
        onError: (err, variables, context) => {
            toast.error(`Update failed: ${err.message}`);
            if (context?.previousGraphData) {
                queryClient.setQueryData(["graph", variables.projectId], context.previousGraphData);
            }
        },
        onSettled: (data, error, variables) => {
            // Invalidate and refetch to ensure we're in sync with the server
            queryClient.invalidateQueries({ queryKey: ["graph", variables.projectId] });
        },
    });
};
