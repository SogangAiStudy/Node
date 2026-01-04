import OpenAI from "openai";

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }
        openaiClient = new OpenAI({ apiKey });
    }
    return openaiClient;
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per user

export function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        return false;
    }

    entry.count++;
    return true;
}

// Simple in-memory cache for blocked analysis
const blockAnalysisCache = new Map<string, { result: any; nodeUpdatedAt: string; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedBlockAnalysis(nodeId: string, nodeUpdatedAt: string): any | null {
    const entry = blockAnalysisCache.get(nodeId);
    if (!entry) return null;

    const now = Date.now();
    // Invalidate if node was updated or cache expired
    if (entry.nodeUpdatedAt !== nodeUpdatedAt || now - entry.cachedAt > CACHE_TTL_MS) {
        blockAnalysisCache.delete(nodeId);
        return null;
    }

    return entry.result;
}

export function setCachedBlockAnalysis(nodeId: string, nodeUpdatedAt: string, result: any): void {
    blockAnalysisCache.set(nodeId, {
        result,
        nodeUpdatedAt,
        cachedAt: Date.now(),
    });
}

// Structured response types
export interface BlockAnalysisResult {
    reasons: Array<{
        summary: string;
        details: string;
    }>;
    nextActions: Array<{
        action: string;
        priority: "high" | "medium" | "low";
    }>;
    contacts: Array<{
        type: "USER" | "TEAM";
        id: string;
        name: string;
        reason: string;
    }>;
}

export interface DraftRequestResult {
    draft: string;
    tone: "formal" | "friendly" | "urgent";
}

export interface GeneratedNode {
    title: string;
    description: string;
    type: "TASK" | "DECISION" | "BLOCKER" | "INFOREQ";
}

export interface GeneratedEdge {
    fromIndex: number;
    toIndex: number;
    relation: "DEPENDS_ON" | "APPROVAL_BY";
}

export interface NodeGenerationResult {
    nodes: GeneratedNode[];
    edges: GeneratedEdge[];
}

export interface ClusterSuggestion {
    name: string;
    nodeIds: string[];
    reason: string;
}

export interface OrganizeResult {
    clusters: ClusterSuggestion[];
    layoutSuggestion: "horizontal" | "vertical" | "radial" | "hierarchical";
}
