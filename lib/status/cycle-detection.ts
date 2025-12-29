import { Edge, EdgeRelation } from "@prisma/client";

/**
 * Detects if adding a new DEPENDS_ON edge would create a cycle in the dependency graph
 * Uses BFS to check if there's already a path from newEdge.toNodeId to newEdge.fromNodeId
 *
 * @param existingEdges - All existing DEPENDS_ON edges in the project
 * @param newEdge - The new edge to be added (fromNodeId DEPENDS_ON toNodeId)
 * @returns true if adding this edge would create a cycle, false otherwise
 */
export function wouldCreateCycle(
  existingEdges: Edge[],
  newEdge: { fromNodeId: string; toNodeId: string; relation: EdgeRelation }
): boolean {
  // Only check for cycles in DEPENDS_ON relationships
  if (newEdge.relation !== EdgeRelation.DEPENDS_ON) {
    return false;
  }

  // Filter only DEPENDS_ON edges
  const dependsOnEdges = existingEdges.filter((edge) => edge.relation === EdgeRelation.DEPENDS_ON);

  // Build adjacency list for the graph
  // If A DEPENDS_ON B, then there's a directed edge from A to B
  const graph = new Map<string, string[]>();

  for (const edge of dependsOnEdges) {
    if (!graph.has(edge.fromNodeId)) {
      graph.set(edge.fromNodeId, []);
    }
    graph.get(edge.fromNodeId)!.push(edge.toNodeId);
  }

  // Add the new edge temporarily to check for cycles
  if (!graph.has(newEdge.fromNodeId)) {
    graph.set(newEdge.fromNodeId, []);
  }
  graph.get(newEdge.fromNodeId)!.push(newEdge.toNodeId);

  // Check if there's a path from newEdge.toNodeId back to newEdge.fromNodeId
  // If such a path exists, adding this edge creates a cycle
  return hasPath(graph, newEdge.toNodeId, newEdge.fromNodeId);
}

/**
 * BFS to check if there's a path from start to target in the directed graph
 */
function hasPath(graph: Map<string, string[]>, start: string, target: string): boolean {
  if (start === target) return true;

  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      if (neighbor === target) {
        return true; // Found a path
      }

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false; // No path found
}

/**
 * Get all nodes in a cycle path for debugging/error messages
 */
export function findCyclePath(
  existingEdges: Edge[],
  newEdge: { fromNodeId: string; toNodeId: string; relation: EdgeRelation }
): string[] | null {
  if (newEdge.relation !== EdgeRelation.DEPENDS_ON) {
    return null;
  }

  const dependsOnEdges = existingEdges.filter((edge) => edge.relation === EdgeRelation.DEPENDS_ON);

  // Build adjacency list
  const graph = new Map<string, string[]>();
  for (const edge of dependsOnEdges) {
    if (!graph.has(edge.fromNodeId)) {
      graph.set(edge.fromNodeId, []);
    }
    graph.get(edge.fromNodeId)!.push(edge.toNodeId);
  }

  // Add the new edge
  if (!graph.has(newEdge.fromNodeId)) {
    graph.set(newEdge.fromNodeId, []);
  }
  graph.get(newEdge.fromNodeId)!.push(newEdge.toNodeId);

  // BFS with path tracking
  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [
    { node: newEdge.toNodeId, path: [newEdge.toNodeId] },
  ];
  visited.add(newEdge.toNodeId);

  while (queue.length > 0) {
    const { node: current, path } = queue.shift()!;

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      if (neighbor === newEdge.fromNodeId) {
        // Found cycle
        return [...path, neighbor];
      }

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null;
}
