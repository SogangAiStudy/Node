"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { NodeDTO, GraphData } from "@/types";
import { CustomNode } from "./CustomNode";
import { Toolbar } from "./Toolbar";

interface GraphCanvasProps {
  projectId: string;
  data: GraphData;
  onDataChange: () => void;
}

const nodeTypes = {
  custom: CustomNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 100;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({ rankdir: direction });

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

    // We are shifting the dagre node position (which is center-based) to top-left
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

export function GraphCanvas({ projectId, data, onDataChange }: GraphCanvasProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const initialNodes: Node[] = data.nodes
      .filter((node) => {
        if (filterStatus !== "ALL" && node.computedStatus !== filterStatus) return false;
        if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase()))
          return false;
        return true;
      })
      .map((node) => ({
        id: node.id,
        type: "custom",
        position: { x: 0, y: 0 },
        data: { node },
      }));

    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    const initialEdges: Edge[] = data.edges
      .filter((edge) => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId))
      .map((edge) => {
        // Precursor (dependency) should be source, Successor (dependent) should be target
        // For HANDOFF_TO: fromNodeId (precursor) -> toNodeId (successor)
        // For others (DEPENDS_ON, etc): toNodeId (precursor) -> fromNodeId (successor)
        const isForward = edge.relation === "HANDOFF_TO";
        return {
          id: edge.id,
          source: isForward ? edge.fromNodeId : edge.toNodeId,
          target: isForward ? edge.toNodeId : edge.fromNodeId,
          label: edge.relation.replace(/_/g, " "),
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          style: {
            strokeWidth: 2,
          },
        };
      });

    const { nodes, edges } = getLayoutedElements(initialNodes, initialEdges);

    // Add extra data for CustomNode
    const nodesWithExtraData = nodes.map((node) => {
      // Find precursors that are blocking this node
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

      // Find successors that this node is blocking
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
          onDataChange,
          blockedBy: blockedByTitles,
          blocking: blockingTitles,
        },
      };
    });

    return { layoutedNodes: nodesWithExtraData, layoutedEdges: edges };
  }, [data.nodes, data.edges, filterStatus, searchQuery, projectId, onDataChange]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes and edges when layout changes
  useMemo(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="relative h-full w-full rounded-lg border bg-white">
      <Toolbar
        projectId={projectId}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onDataChange={onDataChange}
      />

      <div className="h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

