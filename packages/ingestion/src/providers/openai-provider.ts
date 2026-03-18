import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import type { EmbeddingProvider } from "../types.js";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly openai;

  constructor(
    apiKey: string,
    private readonly model = "text-embedding-3-large"
  ) {
    this.openai = createOpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const result = await embed({
      model: this.openai.textEmbeddingModel(this.model),
      value: text
    });
    return result.embedding;
  }
}
