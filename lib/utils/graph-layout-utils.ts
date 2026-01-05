export interface LayoutNode {
    id: string;
    title: string;
    width?: number;
    height?: number;
    phase?: string;
}

export interface LayoutEdge {
    id: string;
    source: string;
    target: string;
}

export interface NodePosition {
    nodeId: string;
    x: number;
    y: number;
}

/**
 * Calculates the longest path depth for each node in a DAG.
 * Roots (in-degree 0) have depth 0.
 */
export function calculateDepths(nodes: LayoutNode[], edges: LayoutEdge[]) {
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    nodes.forEach(n => {
        adj[n.id] = [];
        inDegree[n.id] = 0;
    });

    edges.forEach(e => {
        if (adj[e.source]) adj[e.source].push(e.target);
        if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    const depths: Record<string, number> = {};
    nodes.forEach(n => depths[n.id] = 0);

    const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    const sorted: string[] = [];

    while (queue.length > 0) {
        const u = queue.shift()!;
        sorted.push(u);
        const neighbors = adj[u] || [];
        neighbors.forEach(v => {
            depths[v] = Math.max(depths[v], depths[u] + 1);
            inDegree[v]--;
            if (inDegree[v] === 0) queue.push(v);
        });
    }

    // Cycle defense: Nodes in cycles get high depth
    if (sorted.length < nodes.length) {
        nodes.forEach((n, idx) => {
            if (!sorted.includes(n.id)) {
                depths[n.id] = 999;
            }
        });
    }

    return depths;
}

/**
 * Generates a stable topological order for nodes.
 */
export function getTopologicalOrder(nodes: LayoutNode[], edges: LayoutEdge[]) {
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    nodes.forEach((n) => {
        adj[n.id] = [];
        inDegree[n.id] = 0;
    });

    edges.forEach((e) => {
        if (adj[e.source]) adj[e.source].push(e.target);
        if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const result: string[] = [];

    while (queue.length > 0) {
        // Sort for stable results based on initial array index
        queue.sort((a, b) => {
            const idxA = nodes.findIndex((n) => n.id === a);
            const idxB = nodes.findIndex((n) => n.id === b);
            return idxA - idxB;
        });

        const u = queue.shift()!;
        result.push(u);

        adj[u].forEach((v) => {
            inDegree[v]--;
            if (inDegree[v] === 0) queue.push(v);
        });
    }

    const order: Record<string, number> = {};
    result.forEach((id, idx) => {
        order[id] = idx;
    });

    // Handle cycles
    nodes.forEach((n, idx) => {
        if (order[n.id] === undefined) order[n.id] = 10000 + idx;
    });

    return order;
}

/**
 * Calculates a 5-column grid layout based on depth and topological order.
 */
export function calculateGridLayout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: { columns?: number; xGap?: number; yGap?: number } = {}
): NodePosition[] {
    const { columns = 5, xGap = 100, yGap = 80 } = options;
    const nodeDefaultW = 240;
    const nodeDefaultH = 120;

    const depths = calculateDepths(nodes, edges);
    const topoOrder = getTopologicalOrder(nodes, edges);

    // Primary: Depth, Secondary: Topological Order
    const sortedNodes = [...nodes].sort((a, b) => {
        if (depths[a.id] !== depths[b.id]) return depths[a.id] - depths[b.id];
        return topoOrder[a.id] - topoOrder[b.id];
    });

    const newPositions: NodePosition[] = [];
    let currentY = 0;
    let currentRowMaxHeight = 0;

    sortedNodes.forEach((node, index) => {
        const col = index % columns;

        if (col === 0 && index > 0) {
            currentY += currentRowMaxHeight + yGap;
            currentRowMaxHeight = 0;
        }

        const actualW = node.width || nodeDefaultW;
        const actualH = node.height || nodeDefaultH;
        currentRowMaxHeight = Math.max(currentRowMaxHeight, actualH);

        newPositions.push({
            nodeId: node.id,
            x: col * (nodeDefaultW + xGap),
            y: currentY,
        });
    });

    return newPositions;
}
