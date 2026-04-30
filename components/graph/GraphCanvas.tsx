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
  Connection,
  MarkerType,
  NodeDragHandler,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { NodeDTO, GraphData } from "@/types";
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
const containerMinWidth = 340;
const containerMinHeight = 190;
const containerPadding = 32;
const containerHeaderHeight = 76;

function getNodeDepth(node: NodeDTO, nodeById: Map<string, NodeDTO>) {
  let depth = 0;
  let parentId = node.parentNodeId;

  while (parentId) {
    const parent = nodeById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentNodeId;
  }

  return depth;
}

function isDescendantOf(nodeId: string, possibleAncestorId: string, nodeById: Map<string, NodeDTO>) {
  let parentId = nodeById.get(nodeId)?.parentNodeId ?? null;

  while (parentId) {
    if (parentId === possibleAncestorId) return true;
    parentId = nodeById.get(parentId)?.parentNodeId ?? null;
  }

  return false;
}

function numberStyleValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function getFlowNodeDimensions(flowNode: Node) {
  return {
    width: flowNode.width ?? numberStyleValue(flowNode.style?.width) ?? nodeWidth,
    height: flowNode.height ?? numberStyleValue(flowNode.style?.height) ?? nodeHeight,
  };
}

function getAbsoluteNodePosition(flowNode: Node, allNodes: Node[]) {
  let x = flowNode.position.x;
  let y = flowNode.position.y;
  let parentId = flowNode.parentNode;

  while (parentId) {
    const parent = allNodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentNode;
  }

  return { x, y };
}

async function persistNodeFrame(nodeId: string, parentNodeId: string | null, x: number, y: number) {
  const res = await fetch(`/api/nodes/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parentNodeId,
      positionX: Math.round(x),
      positionY: Math.round(y),
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save node (${res.status})`);
  }
}

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
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

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
  const [addNodeParent, setAddNodeParent] = useState<{ id: string; title: string } | null>(null);
  const [pendingDetachNodeId, setPendingDetachNodeId] = useState<string | null>(null);
  const [layoutDirection] = useState<"LR" | "TB">("LR");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    const childrenByParentId = data.nodes.reduce((map, node) => {
      if (!node.parentNodeId) return map;
      const children = map.get(node.parentNodeId) || [];
      children.push(node);
      map.set(node.parentNodeId, children);
      return map;
    }, new Map<string, NodeDTO[]>());

    const nodeDimensions = new Map<string, { width: number; height: number }>();
    data.nodes.forEach((node) => {
      const children = childrenByParentId.get(node.id) || [];
      if (children.length === 0) {
        nodeDimensions.set(node.id, { width: nodeWidth, height: nodeHeight });
        return;
      }

      const maxChildX = Math.max(0, ...children.map((child) => child.positionX ?? containerPadding));
      const maxChildY = Math.max(0, ...children.map((child) => child.positionY ?? containerHeaderHeight));
      nodeDimensions.set(node.id, {
        width: Math.max(containerMinWidth, maxChildX + nodeWidth + containerPadding),
        height: Math.max(containerMinHeight, maxChildY + nodeHeight + containerPadding),
      });
    });

    const initialNodes: Node[] = data.nodes.map((node) => {
      const x = typeof node.positionX === 'number' && !Number.isNaN(node.positionX)
        ? node.positionX
        : node.parentNodeId ? containerPadding : 0;
      const y = typeof node.positionY === 'number' && !Number.isNaN(node.positionY)
        ? node.positionY
        : node.parentNodeId ? containerHeaderHeight : 0;
      const dimensions = nodeDimensions.get(node.id);
      const childCount = childrenByParentId.get(node.id)?.length || 0;

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
        parentNode: node.parentNodeId || undefined,
        extent: node.parentNodeId ? "parent" : undefined,
        draggable: true,
        zIndex: node.parentNodeId ? 20 + getNodeDepth(node, nodeById) : 0,
        style: childCount > 0 && dimensions
          ? { width: dimensions.width, height: dimensions.height }
          : undefined,
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
        if (nodeData?.parentNodeId) {
          nodesWithSavedPos.push({
            ...node,
            position: {
              x: typeof nodeData.positionX === 'number' && !Number.isNaN(nodeData.positionX) ? nodeData.positionX : containerPadding,
              y: typeof nodeData.positionY === 'number' && !Number.isNaN(nodeData.positionY) ? nodeData.positionY : containerHeaderHeight,
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
          return;
        }

        const hasValidPos =
          nodeData &&
          typeof nodeData.positionX === 'number' && !Number.isNaN(nodeData.positionX) &&
          typeof nodeData.positionY === 'number' && !Number.isNaN(nodeData.positionY);

        if (hasValidPos) {
          // Use saved position and set handle positions
          nodesWithSavedPos.push({
            ...node,
            position: { x: nodeData!.positionX!, y: nodeData!.positionY! },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          });
        } else {
          nodesNeedingLayout.push(node);
        }
      });

      // Auto-layout nodes without saved positions
      if (nodesNeedingLayout.length > 0) {
        const layoutNodeIds = new Set(nodesNeedingLayout.map((node) => node.id));
        const layoutEdges = initialEdges.filter((edge) => layoutNodeIds.has(edge.source) && layoutNodeIds.has(edge.target));
        const { nodes: layoutedNodes } = getLayoutedElements(nodesNeedingLayout, layoutEdges, layoutDirection);
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
          onCreateChild: () => {
            const sourceNode = data.nodes.find((n) => n.id === node.id);
            setAddNodeParent({ id: node.id, title: sourceNode?.title || "selected node" });
            setAddNodeOpen(true);
          },
          onDetachFromParent: () => {
            setPendingDetachNodeId(node.id);
          },
        },
      };
    });

    return {
      layoutedNodes: nodesWithExtraData.sort((a, b) => {
        const aNode = nodeById.get(a.id);
        const bNode = nodeById.get(b.id);
        if (!aNode || !bNode) return 0;
        return getNodeDepth(aNode, nodeById) - getNodeDepth(bNode, nodeById);
      }),
      layoutedEdges: edges,
    };
  }, [data.nodes, data.edges, filterStatus, searchQuery, selectedTeamIds, selectedUserIds, projectId, orgId, onDataChange, layoutDirection]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    if (!pendingDetachNodeId) return;
    const flowNode = nodes.find((node) => node.id === pendingDetachNodeId);
    setPendingDetachNodeId(null);
    if (!flowNode?.parentNode) return;

    const parent = nodes.find((node) => node.id === flowNode.parentNode);
    const absolute = getAbsoluteNodePosition(flowNode, nodes);
    const parentAbsolute = parent ? getAbsoluteNodePosition(parent, nodes) : absolute;
    const parentSize = parent ? getFlowNodeDimensions(parent) : { width: nodeWidth, height: nodeHeight };
    const nextX = parentAbsolute.x + parentSize.width + 48;
    const nextY = absolute.y;

    queryClient.setQueryData<GraphData>(["graph", projectId], (old: GraphData | undefined) => {
      if (!old) return old;
      return {
        ...old,
        nodes: old.nodes.map((node) =>
          node.id === flowNode.id
            ? { ...node, parentNodeId: null, positionX: Math.round(nextX), positionY: Math.round(nextY) }
            : node
        ),
      };
    });

    void persistNodeFrame(flowNode.id, null, nextX, nextY)
      .then(() => {
        toast.success("Node moved out");
        onDataChange();
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to move node");
        onDataChange();
      });
  }, [nodes, onDataChange, pendingDetachNodeId, projectId, queryClient]);

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

  const onNodeDragStop: NodeDragHandler = useCallback(
    async (_event, node) => {
      const currentNodes = nodes.map((candidate) =>
        candidate.id === node.id
          ? {
            ...candidate,
            position: node.position,
            parentNode: node.parentNode,
          }
          : candidate
      );
      const dtoById = new Map(data.nodes.map((candidate) => [candidate.id, candidate]));
      const draggedDto = dtoById.get(node.id);
      const draggedAbsolute = getAbsoluteNodePosition(
        currentNodes.find((candidate) => candidate.id === node.id) || node,
        currentNodes
      );
      const draggedSize = getFlowNodeDimensions(node);
      const draggedCenter = {
        x: draggedAbsolute.x + draggedSize.width / 2,
        y: draggedAbsolute.y + draggedSize.height / 2,
      };

      const dropTarget = currentNodes
        .filter((candidate) => {
          if (candidate.id === node.id) return false;
          if (!draggedDto) return false;
          if (isDescendantOf(candidate.id, node.id, dtoById)) return false;
          return true;
        })
        .sort((a, b) => {
          const aDto = dtoById.get(a.id);
          const bDto = dtoById.get(b.id);
          if (!aDto || !bDto) return 0;
          return getNodeDepth(bDto, dtoById) - getNodeDepth(aDto, dtoById);
        })
        .find((candidate) => {
          const absolute = getAbsoluteNodePosition(candidate, currentNodes);
          const size = getFlowNodeDimensions(candidate);
          return (
            draggedCenter.x >= absolute.x &&
            draggedCenter.x <= absolute.x + size.width &&
            draggedCenter.y >= absolute.y &&
            draggedCenter.y <= absolute.y + size.height
          );
        });

      const nextParentId = dropTarget?.id || node.parentNode || null;
      const parentChanged = (draggedDto?.parentNodeId || null) !== nextParentId;
      const nextPosition = (() => {
        if (!dropTarget || !parentChanged) {
          return node.position;
        }

        const targetAbsolute = getAbsoluteNodePosition(dropTarget, currentNodes);
        return {
          x: Math.max(containerPadding, draggedAbsolute.x - targetAbsolute.x),
          y: Math.max(containerHeaderHeight, draggedAbsolute.y - targetAbsolute.y),
        };
      })();

      // Optimistically update the cache to avoid snap-back
      queryClient.setQueryData<GraphData>(["graph", projectId], (old: GraphData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          nodes: old.nodes.map((n) =>
            n.id === node.id
              ? {
                ...n,
                parentNodeId: nextParentId,
                positionX: Math.round(nextPosition.x),
                positionY: Math.round(nextPosition.y),
              }
              : n
          ),
        };
      });

      // Persist node position to database
      try {
        await persistNodeFrame(node.id, nextParentId, nextPosition.x, nextPosition.y);
        if (parentChanged && dropTarget) {
          toast.success(`Moved inside ${data.nodes.find((n) => n.id === dropTarget.id)?.title || "node"}`);
          onDataChange();
        }
      } catch (error) {
        console.error("Failed to save node position:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save position");
        // Revert cache on error (optional, but good practice - skipped for brevity or add if needed)
        onDataChange(); // Refetch to restore correct state
      }
    },
    [data.nodes, nodes, projectId, queryClient, onDataChange]
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
                onClick={() => {
                  setAddNodeParent(null);
                  setAddNodeOpen(true);
                }}
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
            onAddNode={() => {
              setAddNodeParent(null);
              setAddNodeOpen(true);
            }}
          />
        )}
      </div>

      {/* Add Node Dialog */}
      <AddNodeDialog
        projectId={projectId}
        orgId={orgId}
        parentNodeId={addNodeParent?.id || null}
        parentNodeTitle={addNodeParent?.title || null}
        open={addNodeOpen}
        onOpenChange={setAddNodeOpen}
        onSuccess={() => {
          onDataChange();
          setAddNodeParent(null);
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
                } catch {
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
