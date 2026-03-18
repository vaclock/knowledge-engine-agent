import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import type { EmbeddingProvider } from "../types.js";

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly google;

  constructor(
    apiKey: string,
    model = "text-embedding-004",
    private readonly outputDimensionality?: number
  ) {
    this.google = createGoogleGenerativeAI({ apiKey });
    this.model = model;
  }
  private readonly model: string;

  async embed(text: string): Promise<number[]> {
    const result = await embed({
      model: this.google.textEmbeddingModel(this.model),
      value: text
    });
    const vector = result.embedding;
    if (!this.outputDimensionality) {
      return vector;
    }
    if (vector.length >= this.outputDimensionality) {
      return vector.slice(0, this.outputDimensionality);
    }
    return [...vector, ...new Array(this.outputDimensionality - vector.length).fill(0)];
  }
}
