import { useCallback, useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeDragHandler,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { NodeDTO, GraphData, EdgeRelation } from "@/types";
import { CustomNode } from "./CustomNode";
import { ActionCenterBar } from "./ActionCenterBar";
import { Toolbar } from "./Toolbar";
import { CanvasContextMenu, ContextMenuPosition } from "./CanvasContextMenu";
import { AddNodeDialog } from "./AddNodeDialog";
import { NodeDetailSheet } from "./NodeDetailSheet";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GraphCanvasProps {
  orgId: string;
  projectId: string;
  data: GraphData;
  onDataChange: () => void;
  focusNodeId?: string | null;
}

const nodeTypes = {
  custom: CustomNode,
};

const nodeWidth = 240;
const nodeHeight = 120;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";

  // Optimized layout settings for edge crossing minimization and visual clarity
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 100,     // Space between layers (horizontal in LR, vertical in TB)
    nodesep: 60,      // Space between nodes in the same layer
    edgesep: 25,      // Minimum edge separation
    marginx: 30,      // Horizontal margin
    marginy: 30,      // Vertical margin
    acyclicer: "greedy",  // Algorithm for making graphs acyclic
    ranker: "network-simplex",  // Ranking algorithm (best for minimizing edge crossings)
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? ("left" as any) : ("top" as any);
    node.sourcePosition = isHorizontal ? ("right" as any) : ("bottom" as any);

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export function GraphCanvas({ projectId, orgId, data, onDataChange, focusNodeId }: GraphCanvasProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [relation, setRelation] = useState<string>("DEPENDS_ON");
  const [isSyncing, setIsSyncing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodePosition, setAddNodePosition] = useState<{ x: number; y: number } | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<"LR" | "TB">("LR");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const initialNodes: Node[] = data.nodes.map((node) => {
      const x = typeof node.positionX === 'number' && !Number.isNaN(node.positionX) ? node.positionX : 0;
      const y = typeof node.positionY === 'number' && !Number.isNaN(node.positionY) ? node.positionY : 0;

      // Calculate if this node matches the current filters
      let isFaded = false;
      if (filterStatus !== "ALL" && node.computedStatus !== filterStatus) isFaded = true;
      if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase())) isFaded = true;

      if (selectedTeamIds.length > 0) {
        const nodeTeamIds = node.teams.map((t) => t.id);
        const hasMatch = selectedTeamIds.some((id) => nodeTeamIds.includes(id));
        if (!hasMatch) isFaded = true;
      }

      if (selectedUserIds.length > 0) {
        const nodeOwnerIds = node.owners.map((o) => o.id);
        const hasMatch = selectedUserIds.some((id) => nodeOwnerIds.includes(id));
        if (!hasMatch) isFaded = true;
      }

      return {
        id: node.id,
        type: "custom",
        position: { x, y },
        data: {
          node,
          isFaded // Pass faded state to the node component
        },
      };
    });

    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    const initialEdges: Edge[] = data.edges
      .filter((edge) => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId))
      .map((edge) => {
        const isForward = edge.relation === "HANDOFF_TO";
        return {
          id: edge.id,
          source: isForward ? edge.fromNodeId : edge.toNodeId,
          target: isForward ? edge.toNodeId : edge.fromNodeId,
          type: "smoothstep",
          label: edge.relation.replace(/_/g, " "),
          pathOptions: { borderRadius: 12 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#64748b",
          },
          style: {
            strokeWidth: 2,
            stroke: "#94a3b8",
          },
          data: { originalEdge: edge },
        };
      });

    // Apply positions: use saved positions or auto-layout
    const { nodes, edges } = (() => {
      const nodesWithSavedPos: Node[] = [];
      const nodesNeedingLayout: Node[] = [];

      initialNodes.forEach((node) => {
        const nodeData = data.nodes.find((n) => n.id === node.id);
        const hasValidPos =
          nodeData &&
          typeof nodeData.positionX === 'number' && !Number.isNaN(nodeData.positionX) &&
          typeof nodeData.positionY === 'number' && !Number.isNaN(nodeData.positionY);

        if (hasValidPos) {
          // Use saved position and set handle positions
          nodesWithSavedPos.push({
            ...node,
            position: { x: nodeData!.positionX!, y: nodeData!.positionY! },
            sourcePosition: "right" as any,
            targetPosition: "left" as any,
          });
        } else {
          nodesNeedingLayout.push(node);
        }
      });

      // Auto-layout nodes without saved positions
      if (nodesNeedingLayout.length > 0) {
        const { nodes: layoutedNodes } = getLayoutedElements(nodesNeedingLayout, initialEdges, layoutDirection);
        return { nodes: [...nodesWithSavedPos, ...layoutedNodes], edges: initialEdges };
      }

      return { nodes: nodesWithSavedPos, edges: initialEdges };
    })();

    const nodesWithExtraData = nodes.map((node) => {
      const blockedByTitles = data.edges
        .filter((e) => {
          if (e.relation === "HANDOFF_TO") return e.toNodeId === node.id;
          return e.fromNodeId === node.id;
        })
        .map((e) => {
          const precursorId = e.relation === "HANDOFF_TO" ? e.fromNodeId : e.toNodeId;
          return data.nodes.find((n) => n.id === precursorId);
        })
        .filter((n): n is NodeDTO => !!n && n.computedStatus !== "DONE")
        .map((n) => n.title);

      const blockingTitles = data.edges
        .filter((e) => {
          if (e.relation === "HANDOFF_TO") return e.fromNodeId === node.id;
          return e.toNodeId === node.id;
        })
        .map((e) => {
          const successorId = e.relation === "HANDOFF_TO" ? e.toNodeId : e.fromNodeId;
          return data.nodes.find((n) => n.id === successorId);
        })
        .filter((n): n is NodeDTO => !!n)
        .map((n) => n.title);

      return {
        ...node,
        data: {
          ...node.data,
          node: data.nodes.find((n) => n.id === node.id),
          projectId,
          orgId,
          onDataChange,
          blockedBy: blockedByTitles,
          blocking: blockingTitles,
          onOpenDetail: () => {
            setSelectedNodeId(node.id);
            setIsSheetOpen(true);
          },
        },
      };
    });

    return { layoutedNodes: nodesWithExtraData, layoutedEdges: edges };
  }, [data.nodes, data.edges, filterStatus, searchQuery, selectedTeamIds, selectedUserIds, projectId, orgId, onDataChange, layoutDirection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Focus on specific node when focusNodeId is provided
  useEffect(() => {
    if (focusNodeId) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === focusNodeId,
        }))
      );
    }
  }, [focusNodeId, setNodes]);

  useMemo(() => {
    setNodes((nds) =>
      layoutedNodes.map((newNode) => {
        const existingNode = nds.find((n) => n.id === newNode.id);
        if (existingNode) {
          return {
            ...newNode,
            selected: existingNode.selected,
          };
        }
        return newNode;
      })
    );
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    setPendingConnection(params);
    setRelation("DEPENDS_ON");
  }, []);

  const handleCreateEdge = async () => {
    if (!pendingConnection) return;
    setIsSyncing(true);
    try {
      // Determine logical from/to based on relation
      // HANDOFF_TO: source -> target
      // Others: target -> source (because handle source is right, target is left, and dependencies are on the left)
      const isForward = relation === "HANDOFF_TO";
      const fromNodeId = isForward ? pendingConnection.source : pendingConnection.target;
      const toNodeId = isForward ? pendingConnection.target : pendingConnection.source;

      const res = await fetch(`/api/projects/${projectId}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromNodeId, toNodeId, relation }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create connection");
      }

      toast.success("Connection created");
      onDataChange();
      setPendingConnection(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error creating connection");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateEdge = async () => {
    if (!editingEdge) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/edges/${editingEdge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relation }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update connection");
      }

      toast.success("Connection updated");
      onDataChange();
      setEditingEdge(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error updating connection");
    } finally {
      setIsSyncing(false);
    }
  };

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
    setRelation(edge.data?.originalEdge?.relation || "DEPENDS_ON");
  }, []);

  const queryClient = useQueryClient();

  const onNodeDragStop: NodeDragHandler = useCallback(
    async (_event, node) => {
      // Optimistically update the cache to avoid snap-back
      queryClient.setQueryData<GraphData>(["graph", projectId], (old: GraphData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map((n) =>
            n.id === node.id
              ? { ...n, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) }
              : n
          ),
        };
      });

      // Persist node position to database
      try {
        const res = await fetch(`/api/nodes/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: Math.round(node.position.x),
            positionY: Math.round(node.position.y),
          }),
        });

        if (res.ok) {
          // toast.success("Position saved", { duration: 1000 });
          // No need to refetch everything!
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error("Position save failed:", res.status, errorData);
          throw new Error(errorData.error || `Failed to save position (${res.status})`);
        }
      } catch (error) {
        console.error("Failed to save node position:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save position");
        // Revert cache on error (optional, but good practice - skipped for brevity or add if needed)
        onDataChange(); // Refetch to restore correct state
      }
    },
    [projectId, queryClient, onDataChange]
  );

  const handleOrganizeApply = useCallback(
    (positions: Array<{ nodeId: string; x: number; y: number }>) => {
      // Update local state immediately
      setNodes((nds) =>
        nds.map((node) => {
          const newPos = positions.find((p) => p.nodeId === node.id);
          if (newPos) {
            return {
              ...node,
              position: { x: newPos.x, y: newPos.y },
            };
          }
          return node;
        })
      );

      // Refetch data to sync with server
      onDataChange();
    },
    [setNodes, onDataChange]
  );

  return (
    <div className="relative h-full w-full flex flex-col rounded-lg border bg-white overflow-hidden shadow-inner">
      {/* Action Center Bar at Top */}
      <ActionCenterBar
        nodes={data.nodes}
        edges={data.edges}
        userId={useSession().data?.user?.id || ""}
        onNodeClick={(nodeId) => {
          setSelectedNodeId(nodeId);
          setIsSheetOpen(false); // Valid: Reset sheet on new click
          setNodes((nds) =>
            nds.map((node) => ({
              ...node,
              selected: node.id === nodeId,
            }))
          );
        }}
      />

      {/* Canvas (full remaining height) */}
      <div className="flex-1 relative" onClick={() => setContextMenu(null)}>
        <Toolbar
          orgId={orgId}
          projectId={projectId}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          selectedTeamIds={selectedTeamIds}
          onTeamFilterChange={setSelectedTeamIds}
          selectedUserIds={selectedUserIds}
          onUserFilterChange={setSelectedUserIds}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onDataChange={onDataChange}
          nodes={nodes}
          edges={edges}
          onOrganizeApply={handleOrganizeApply}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={(_event, node) => {
            setSelectedNodeId(node.id);
            setIsSheetOpen(false);
          }}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              canvasX: event.clientX,
              canvasY: event.clientY,
            });
          }}
          onPaneClick={() => {
            setContextMenu(null);
            setSelectedNodeId(null);
            setIsSheetOpen(false);
          }}
        >
          <Background color="#f1f5f9" gap={15} />
          <Controls />
          <MiniMap nodeStrokeColor="#e2e8f0" nodeColor="#f8fafc" />
        </ReactFlow>

        {/* Empty State */}
        {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-8 text-center max-w-md pointer-events-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No nodes yet</h3>
              <p className="text-slate-500 text-sm mb-6">
                Right-click anywhere on the canvas to add your first node,
                or click the button below to get started.
              </p>
              <Button
                onClick={() => setAddNodeOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add First Node
              </Button>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <CanvasContextMenu
            position={contextMenu}
            onClose={() => setContextMenu(null)}
            onAddNode={(x, y) => {
              setAddNodePosition({ x, y });
              setAddNodeOpen(true);
            }}
          />
        )}
      </div>

      {/* Add Node Dialog */}
      <AddNodeDialog
        projectId={projectId}
        orgId={orgId}
        open={addNodeOpen}
        onOpenChange={setAddNodeOpen}
        onSuccess={() => {
          onDataChange();
          setAddNodeOpen(false);
        }}
      />

      {/* Connection Picker Dialog */}
      <Dialog open={!!pendingConnection} onOpenChange={() => setPendingConnection(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Define Relationship</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>How are these nodes related?</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPENDS_ON">Depends On (Left depends on Right)</SelectItem>
                  <SelectItem value="HANDOFF_TO">Handoff To (Left leads to Right)</SelectItem>
                  <SelectItem value="NEEDS_INFO_FROM">Needs Info From</SelectItem>
                  <SelectItem value="APPROVAL_BY">Approval By</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-slate-500 italic bg-slate-50 p-3 rounded-md border border-slate-100">
              {relation === "DEPENDS_ON" && "The right-side node must be completed before the left-side node can start."}
              {relation === "HANDOFF_TO" && "Work flows directly from the left-side node to the right-side node."}
              {relation === "NEEDS_INFO_FROM" && "The left-side node requires specific input from the right-side node."}
              {relation === "APPROVAL_BY" && "The left-side node is waiting for a formal decision/approval from the right-side node."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingConnection(null)}>Cancel</Button>
            <Button onClick={handleCreateEdge} disabled={isSyncing}>
              {isSyncing ? "Creating..." : "Create Connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edge Edit Dialog */}
      <Dialog open={!!editingEdge} onOpenChange={() => setEditingEdge(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Update the relation type</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPENDS_ON">Depends On</SelectItem>
                  <SelectItem value="HANDOFF_TO">Handoff To</SelectItem>
                  <SelectItem value="NEEDS_INFO_FROM">Needs Info From</SelectItem>
                  <SelectItem value="APPROVAL_BY">Approval By</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!editingEdge) return;
                setIsSyncing(true);
                try {
                  const res = await fetch(`/api/edges/${editingEdge.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Delete failed");
                  toast.success("Connection removed");
                  onDataChange();
                  setEditingEdge(null);
                } catch (e) {
                  toast.error("Failed to delete connection");
                } finally {
                  setIsSyncing(false);
                }
              }}
            >
              Remove
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingEdge(null)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdateEdge} disabled={isSyncing}>
                {isSyncing ? "Saving..." : "Update"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Detail Sheet */}
      <NodeDetailSheet
        node={data.nodes.find(n => n.id === selectedNodeId) || null}
        open={!!selectedNodeId && isSheetOpen}
        onOpenChange={(open: boolean) => setIsSheetOpen(open)}
        projectId={projectId}
        orgId={orgId}
        onDataChange={onDataChange}
      />
    </div>
  );
}

