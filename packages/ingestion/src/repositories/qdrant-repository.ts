import { QdrantClient } from "@qdrant/js-client-rest";
import type {
  EmbeddedChunk,
  EmbeddedChunkPayload,
  SearchResult,
  VectorRepository
} from "../types.js";

export class QdrantVectorRepository implements VectorRepository {
  private readonly client: QdrantClient;
  private initialized = false;

  constructor(
    config: { url: string; apiKey?: string },
    private readonly collectionName: string,
    private readonly vectorSize: number
  ) {
    this.client = new QdrantClient(config);
  }

  private async ensureCollection() {
    if (this.initialized) return;
    try {
      await this.client.getCollection(this.collectionName);
    } catch {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine"
        }
      });
    }
    this.initialized = true;
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    await this.ensureCollection();
    if (chunks.length === 0) return;
    await this.client.upsert(this.collectionName, {
      wait: true,
      points: chunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.vector,
        payload: {
          sourceId: chunk.sourceId,
          text: chunk.text,
          metadata: chunk.metadata
        }
      }))
    });
  }

  async search(queryVector: number[], limit: number, threshold: number): Promise<SearchResult[]> {
    await this.ensureCollection();
    const result = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      score_threshold: threshold,
      with_payload: true,
      with_vector: true
    });
    const points = result as Array<{
      id: string | number;
      payload?: unknown;
      vector?: number[] | number[][] | Record<string, number[]> | null;
      score?: number;
    }>;
    return points.map((point) => {
      const payload = (point.payload ?? {}) as EmbeddedChunkPayload;
      const vector = Array.isArray(point.vector)
        ? (point.vector as number[])
        : Object.values(point.vector ?? {})[0] ?? [];
      return {
        id: String(point.id),
        sourceId: payload.sourceId,
        text: payload.text,
        metadata: payload.metadata,
        vector,
        score: point.score ?? 0
      };
    });
  }

  async clear(): Promise<void> {
    await this.ensureCollection();
    await this.client.delete(this.collectionName, {
      filter: {}
    });
  }
}
