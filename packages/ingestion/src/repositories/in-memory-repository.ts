import { cosineSimilarity } from "../scoring.js";
import type { EmbeddedChunk, SearchResult, VectorRepository } from "../types.js";

export class InMemoryVectorRepository implements VectorRepository {
  private readonly docs = new Map<string, EmbeddedChunk>();

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    chunks.forEach((chunk) => this.docs.set(chunk.id, chunk));
  }

  async search(queryVector: number[], limit: number, threshold: number): Promise<SearchResult[]> {
    return [...this.docs.values()]
      .map((doc) => ({ ...doc, score: cosineSimilarity(queryVector, doc.vector) }))
      .filter((doc) => doc.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async clear(): Promise<void> {
    this.docs.clear();
  }
}
