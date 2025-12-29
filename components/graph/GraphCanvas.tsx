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
import "reactflow/dist/style.css";
import { NodeDTO, EdgeDTO, GraphData } from "@/types";
import { CustomNode } from "./CustomNode";
import { Toolbar } from "./Toolbar";
import { NodeDetailPanel } from "./NodeDetailPanel";

interface GraphCanvasProps {
  projectId: string;
  data: GraphData;
  onDataChange: () => void;
}

const nodeTypes = {
  custom: CustomNode,
};

export function GraphCanvas({ projectId, data, onDataChange }: GraphCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Convert DTOs to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
    return data.nodes
      .filter((node) => {
        if (filterStatus !== "ALL" && node.computedStatus !== filterStatus) return false;
        if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase()))
          return false;
        return true;
      })
      .map((node, index) => ({
        id: node.id,
        type: "custom",
        position: { x: (index % 5) * 300, y: Math.floor(index / 5) * 200 },
        data: { node },
      }));
  }, [data.nodes, filterStatus, searchQuery]);

  const initialEdges: Edge[] = useMemo(() => {
    const visibleNodeIds = new Set(initialNodes.map((n) => n.id));
    return data.edges
      .filter((edge) => visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId))
      .map((edge) => ({
        id: edge.id,
        source: edge.fromNodeId,
        target: edge.toNodeId,
        label: edge.relation.replace(/_/g, " "),
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          strokeWidth: 2,
        },
      }));
  }, [data.edges, initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when data or filters change
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId);
  }, [selectedNodeId, data.nodes]);

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
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodeDetailPanel
          projectId={projectId}
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onDataChange={onDataChange}
        />
      )}
    </div>
  );
}
