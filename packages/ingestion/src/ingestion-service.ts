import { splitTextIntoChunks } from "./chunking.js";
import { tokenize } from "./scoring.js";
import type { EmbeddedChunk, EmbeddingProvider, VectorRepository } from "./types.js";

export interface IngestChunkPreview {
  id: string;
  text: string;
  tokens: string[];
}

export interface IngestResult {
  count: number;
  chunks: IngestChunkPreview[];
}

export class IngestionService {
  constructor(
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorRepository: VectorRepository
  ) {}

  async ingest(sourceId: string, content: string): Promise<IngestResult> {
    const chunks = splitTextIntoChunks(content);
    const embedded: EmbeddedChunk[] = [];
    const previews: IngestChunkPreview[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const text = chunks[i];
      const vector = await this.embeddingProvider.embed(text);
      const id = `${sourceId}:${i}`;
      embedded.push({
        id,
        sourceId,
        text,
        vector
      });
      previews.push({
        id,
        text,
        tokens: tokenize(text).slice(0, 32)
      });
    }
    await this.vectorRepository.upsert(embedded);
    return {
      count: embedded.length,
      chunks: previews
    };
  }

  async retrieve(query: string, limit = 4, threshold = 0.15, alpha = 0.8) {
    const vector = await this.embeddingProvider.embed(query);
    const candidates = await this.vectorRepository.search(vector, Math.max(limit * 10, 50), 0);
    const queryTokens = tokenize(query);
    return candidates
      .map((candidate) => {
        if (queryTokens.length === 0) return candidate;
        const lowerText = candidate.text.toLowerCase();
        const hitCount = queryTokens.reduce(
          (count, token) => (lowerText.includes(token) ? count + 1 : count),
          0
        );
        const sparseScore = hitCount / queryTokens.length;
        return {
          ...candidate,
          score: alpha * candidate.score + (1 - alpha) * sparseScore
        };
      })
      .filter((item) => item.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async clear() {
    await this.vectorRepository.clear();
  }
}
