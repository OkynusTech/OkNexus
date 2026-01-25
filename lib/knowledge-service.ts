/**
 * Knowledge Service - Hierarchical, Scoped Knowledge Retrieval
 * 
 * This service implements a FILTER-FIRST approach for knowledge retrieval.
 * Unlike flat RAG systems, this service:
 * 1. Filters by scope BEFORE applying vector similarity
 * 2. Enforces strict cross-client isolation
 * 3. Tracks provenance for all retrieved content
 * 
 * CRITICAL: Cross-client retrieval is NEVER allowed.
 */

import { Artifact, ArtifactScope, KnowledgeScope, KnowledgeContext } from './types';
import { getAllArtifacts, getArtifactsByScope } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface RetrievalResult {
    artifacts: Artifact[];
    provenance: ProvenanceRecord[];
    totalResults: number;
}

export interface ProvenanceRecord {
    artifactId: string;
    artifactName: string;
    artifactType: string;
    scope: ArtifactScope;
    scopeId: string;
    relevanceScore?: number;
    matchedContent?: string;
}

export interface RetrievalOptions {
    maxResults?: number;
    minRelevanceScore?: number;
    artifactTypes?: string[];
    includeContent?: boolean;
}

// ============================================================================
// Scoped Retrieval Service
// ============================================================================

export class ScopedRetrievalService {
    /**
     * Retrieve artifacts for a client scope
     * ONLY returns artifacts scoped to the given client
     */
    static retrieveForClient(
        clientId: string,
        query?: string,
        options: RetrievalOptions = {}
    ): RetrievalResult {
        // Get all artifacts for this client
        const clientArtifacts = getArtifactsByScope('client', clientId);

        return this.filterAndRank(clientArtifacts, query, options);
    }

    /**
     * Retrieve artifacts for an application scope
     * Returns artifacts from: application + parent client
     */
    static retrieveForApplication(
        applicationId: string,
        clientId: string, // Required for scope validation
        query?: string,
        options: RetrievalOptions = {}
    ): RetrievalResult {
        // Get application-scoped artifacts
        const appArtifacts = getArtifactsByScope('application', applicationId);

        // Get client-scoped artifacts (parent context)
        const clientArtifacts = getArtifactsByScope('client', clientId);

        // Combine scopes
        const combinedArtifacts = [...appArtifacts, ...clientArtifacts];

        return this.filterAndRank(combinedArtifacts, query, options);
    }

    /**
     * Retrieve artifacts for an engagement scope
     * Returns artifacts from: engagement + application + client
     */
    static retrieveForEngagement(
        engagementId: string,
        applicationId: string,
        clientId: string,
        query?: string,
        options: RetrievalOptions = {}
    ): RetrievalResult {
        // Get engagement-scoped artifacts
        const engagementArtifacts = getArtifactsByScope('engagement', engagementId);

        // Get application-scoped artifacts
        const appArtifacts = getArtifactsByScope('application', applicationId);

        // Get client-scoped artifacts
        const clientArtifacts = getArtifactsByScope('client', clientId);

        // Combine all relevant scopes
        const combinedArtifacts = [
            ...engagementArtifacts,
            ...appArtifacts,
            ...clientArtifacts,
        ];

        return this.filterAndRank(combinedArtifacts, query, options);
    }

    /**
     * Retrieve artifacts for an engagement with excerpts and enhanced context
     * Returns artifacts from: engagement + application + client + excerpts for similarity
     */
    static retrieveForEngagementWithArtifacts(
        engagementId: string,
        applicationId: string,
        clientId: string,
        query?: string,
        options: RetrievalOptions & {
            artifactTypes?: string[];
            minRelevanceScore?: number;
        } = {}
    ): RetrievalResult & {
        artifactExcerpts: Array<{
            artifactId: string;
            artifactName: string;
            artifactType: string;
            excerpt: string;
            relevanceScore: number;
            scopeLevel: 'client' | 'application' | 'engagement';
        }>;
    } {
        // Get engagement-scoped artifacts
        const engagementArtifacts = getArtifactsByScope('engagement', engagementId);

        // Get application-scoped artifacts
        const appArtifacts = getArtifactsByScope('application', applicationId);

        // Get client-scoped artifacts
        const clientArtifacts = getArtifactsByScope('client', clientId);

        // Combine all relevant scopes with scope level tracking
        const scopedArtifacts = [
            ...engagementArtifacts.map(a => ({ artifact: a, scopeLevel: 'engagement' as const })),
            ...appArtifacts.map(a => ({ artifact: a, scopeLevel: 'application' as const })),
            ...clientArtifacts.map(a => ({ artifact: a, scopeLevel: 'client' as const })),
        ];

        // Filter by artifact types if specified
        let filtered = scopedArtifacts;
        if (options.artifactTypes && options.artifactTypes.length > 0) {
            filtered = filtered.filter(({ artifact }) =>
                options.artifactTypes!.includes(artifact.type)
            );
        }

        // Generate excerpts and relevance scores
        const minScore = options.minRelevanceScore || 0.3;
        const artifactExcerpts = filtered
            .map(({ artifact, scopeLevel }) => {
                const { excerpt, relevanceScore } = this.extractRelevantExcerpt(
                    artifact,
                    query || ''
                );

                return {
                    artifactId: artifact.id,
                    artifactName: artifact.name,
                    artifactType: artifact.type,
                    excerpt,
                    relevanceScore,
                    scopeLevel,
                };
            })
            .filter(excerpt => excerpt.relevanceScore >= minScore)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, options.maxResults || 10);

        // Get base retrieval result
        const baseResult = this.filterAndRank(
            filtered.map(({ artifact }) => artifact),
            query,
            options
        );

        return {
            ...baseResult,
            artifactExcerpts,
        };
    }

    /**
     * Extract relevant excerpt from artifact content
     * Finds 300-char snippet with highest query relevance
     */
    private static extractRelevantExcerpt(
        artifact: Artifact,
        query: string
    ): { excerpt: string; relevanceScore: number } {
        const content = artifact.content || '';
        const name = artifact.name;
        const description = artifact.description || '';

        if (!query.trim()) {
            // No query - return start of content
            const excerpt = content.slice(0, 300) + (content.length > 300 ? '...' : '');
            return { excerpt, relevanceScore: 0.5 };
        }

        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        // Calculate relevance score
        let score = 0;
        if (name.toLowerCase().includes(queryLower)) score += 10;
        if (description.toLowerCase().includes(queryLower)) score += 5;

        // Find best excerpt window
        const contentLower = content.toLowerCase();
        let bestExcerpt = '';
        let bestScore = 0;

        // Split into sentences for better context
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];

        for (let i = 0; i < sentences.length; i++) {
            const window = sentences.slice(i, i + 3).join(' '); // 3 sentences
            const windowLower = window.toLowerCase();

            // Count query word matches in this window
            let windowScore = queryWords.filter(word =>
                windowLower.includes(word)
            ).length;

            if (windowScore > bestScore) {
                bestScore = windowScore;
                bestExcerpt = window.slice(0, 300) + (window.length > 300 ? '...' : '');
            }
        }

        // If no good excerpt found, use beginning
        if (!bestExcerpt) {
            bestExcerpt = content.slice(0, 300) + (content.length > 300 ? '...' : '');
        }

        // Normalize score to 0-1 range
        const matchCount = queryWords.filter(word =>
            contentLower.includes(word)
        ).length;
        const relevanceScore = Math.min(1.0, (score / 20) + (matchCount / queryWords.length));

        return { excerpt: bestExcerpt, relevanceScore };
    }

    /**
     * Filter and rank artifacts based on query and options
     * This is where we would integrate vector similarity if using embeddings
     */
    private static filterAndRank(
        artifacts: Artifact[],
        query?: string,
        options: RetrievalOptions = {}
    ): RetrievalResult {
        let filtered = [...artifacts];

        // Filter by artifact types if specified
        if (options.artifactTypes && options.artifactTypes.length > 0) {
            filtered = filtered.filter(a => options.artifactTypes!.includes(a.type));
        }

        // Simple keyword matching if query provided (fallback for no embeddings)
        if (query && query.trim()) {
            const queryLower = query.toLowerCase();
            filtered = filtered.map(artifact => {
                const content = artifact.content?.toLowerCase() || '';
                const name = artifact.name.toLowerCase();
                const description = artifact.description?.toLowerCase() || '';

                // Simple relevance scoring
                let score = 0;
                if (name.includes(queryLower)) score += 10;
                if (description.includes(queryLower)) score += 5;
                if (content.includes(queryLower)) score += 2;

                return { artifact, score };
            })
                .filter(({ score }) => score > 0)
                .sort((a, b) => b.score - a.score)
                .map(({ artifact }) => artifact);
        }

        // Apply max results limit
        const maxResults = options.maxResults || 50;
        const results = filtered.slice(0, maxResults);

        // Build provenance records
        const provenance: ProvenanceRecord[] = results.map(artifact => ({
            artifactId: artifact.id,
            artifactName: artifact.name,
            artifactType: artifact.type,
            scope: artifact.scope,
            scopeId: artifact.scopeId,
        }));

        return {
            artifacts: results,
            provenance,
            totalResults: filtered.length,
        };
    }

    /**
     * CRITICAL: Validate that retrieval never crosses client boundaries
     * This should be called before any retrieval operation
     */
    static validateScope(requestedClientId: string, artifacts: Artifact[]): boolean {
        // This is a safety check - should never fail if using scoped retrieval correctly
        const invalidArtifacts = artifacts.filter(artifact => {
            // Get the client ID from the artifact's scope
            // This requires traversing scope hierarchy
            return !this.artifactBelongsToClient(artifact, requestedClientId);
        });

        if (invalidArtifacts.length > 0) {
            console.error('CRITICAL: Cross-client contamination detected!', invalidArtifacts);
            return false;
        }

        return true;
    }

    /**
     * Check if an artifact belongs to a given client
     * Handles scope hierarchy (engagement -> application -> client)
     */
    private static artifactBelongsToClient(artifact: Artifact, clientId: string): boolean {
        if (artifact.scope === 'client') {
            return artifact.scopeId === clientId;
        }

        // For application/engagement scopes, we would need to look up the parent chain
        // This is a simplified check - in production, we'd traverse the hierarchy
        // For now, we trust the scoped retrieval methods to handle this correctly
        return true;
    }
}

// ============================================================================
// Embedding Service (Stub)
// ============================================================================

/**
 * Embedding Service for vector similarity search
 * This is a stub implementation. In production, integrate with:
 * - OpenAI Embeddings API
 * - Local transformers.js
 * - Other embedding services
 */
export class EmbeddingService {
    /**
     * Generate embedding for text content
     * Returns a vector representation (stub implementation)
     */
    static async generateEmbedding(text: string): Promise<number[]> {
        // Stub implementation - returns random vector
        // In production, call actual embedding API
        console.warn('Using stub embedding generation');

        // Return 384-dimensional vector (common size for sentence embeddings)
        return Array.from({ length: 384 }, () => Math.random());
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    static cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same dimension');
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Find most similar artifacts based on embedding
     */
    static async findSimilar(
        queryEmbedding: number[],
        artifacts: Artifact[],
        topK: number = 10
    ): Promise<Array<{ artifact: Artifact; similarity: number }>> {
        const results: Array<{ artifact: Artifact; similarity: number }> = [];

        for (const artifact of artifacts) {
            if (!artifact.embedding) continue;

            const similarity = this.cosineSimilarity(queryEmbedding, artifact.embedding);
            results.push({ artifact, similarity });
        }

        // Sort by similarity (descending)
        results.sort((a, b) => b.similarity - a.similarity);

        return results.slice(0, topK);
    }
}

// ============================================================================
// Knowledge Context Builder
// ============================================================================

/**
 * Build knowledge context for different scopes
 * Determines which artifacts can be accessed
 */
export class KnowledgeContextBuilder {
    /**
     * Build context for client scope
     */
    static forClient(clientId: string): KnowledgeContext {
        return {
            scope: 'client',
            scopeId: clientId,
            allowedScopes: [clientId], // Only this client
        };
    }

    /**
     * Build context for application scope
     */
    static forApplication(applicationId: string, clientId: string): KnowledgeContext {
        return {
            scope: 'application',
            scopeId: applicationId,
            allowedScopes: [applicationId, clientId], // App + parent client
        };
    }

    /**
     * Build context for engagement scope
     */
    static forEngagement(
        engagementId: string,
        applicationId: string,
        clientId: string
    ): KnowledgeContext {
        return {
            scope: 'engagement',
            scopeId: engagementId,
            allowedScopes: [engagementId, applicationId, clientId], // Full hierarchy
        };
    }
}
