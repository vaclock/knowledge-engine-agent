export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface EmbeddedChunk {
  id: string;
  sourceId: string;
  text: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult extends EmbeddedChunk {
  score: number;
}

export interface EmbeddedChunkPayload {
  sourceId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface VectorRepository {
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  search(queryVector: number[], limit: number, threshold: number): Promise<SearchResult[]>;
  clear(): Promise<void>;
}

export interface EmbeddingProviderFactoryOptions {
  defaultModels?: string[];
  model?: string;
  fallbackModels?: string[];
  apiKey?: string;
  openAIApiKey?: string;
  openAIModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  embeddingDimension?: number;
  fallbackProvider?: EmbeddingProvider;
}
