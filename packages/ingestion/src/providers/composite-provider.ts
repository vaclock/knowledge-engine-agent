import type { EmbeddingProvider } from "../types.js";

export class CompositeEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly providers: EmbeddingProvider[],
    private readonly targetDimension?: number
  ) {}

  private normalizeDimension(vector: number[]) {
    if (!this.targetDimension || vector.length === this.targetDimension) {
      return vector;
    }
    if (vector.length > this.targetDimension) {
      return vector.slice(0, this.targetDimension);
    }
    return [...vector, ...new Array(this.targetDimension - vector.length).fill(0)];
  }

  async embed(text: string): Promise<number[]> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        const vector = await provider.embed(text);
        return this.normalizeDimension(vector);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`All embedding providers failed: ${String(lastError)}`);
  }
}
