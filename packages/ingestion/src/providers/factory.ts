import type { EmbeddingProviderFactoryOptions } from "../types.js";
import { CompositeEmbeddingProvider } from "./composite-provider.js";
import { GeminiEmbeddingProvider } from "./gemini-provider.js";
import { OpenAIEmbeddingProvider } from "./openai-provider.js";

const createProviderFromModelRef = (
  modelRef: string,
  options: EmbeddingProviderFactoryOptions
) => {
  const [provider, ...rest] = modelRef.split("/");
  const model = rest.join("/").trim();
  if (!provider || !model) {
    throw new Error(`Invalid embedding model ref: ${modelRef}`);
  }
  if (provider === "openai") {
    const apiKey = options.apiKey ?? options.openAIApiKey;
    if (!apiKey) throw new Error("OpenAI embedding requires apiKey");
    return new OpenAIEmbeddingProvider(apiKey, model);
  }
  if (provider === "google" || provider === "gemini") {
    const apiKey = options.apiKey ?? options.geminiApiKey;
    if (!apiKey) throw new Error("Google embedding requires apiKey");
    return new GeminiEmbeddingProvider(apiKey, model, options.embeddingDimension);
  }
  const gatewayApiKey = options.apiKey ?? options.gatewayApiKey;
  if (!gatewayApiKey) {
    throw new Error(`Unsupported embedding provider without gateway key: ${provider}`);
  }
  return new OpenAIEmbeddingProvider(gatewayApiKey, modelRef, options.gatewayBaseUrl);
};

export const createEmbeddingProvider = (options: EmbeddingProviderFactoryOptions) => {
  const providers = [];
  const modelRefs = [
    ...(options.model ? [options.model] : []),
    ...(options.fallbackModels ?? []),
    ...(options.defaultModels ?? [])
  ];
  for (const modelRef of modelRefs) {
    providers.push(createProviderFromModelRef(modelRef, options));
  }
  if (modelRefs.length === 0 && options.openAIApiKey) {
    providers.push(new OpenAIEmbeddingProvider(options.openAIApiKey, options.openAIModel));
  }
  if (modelRefs.length === 0 && options.geminiApiKey) {
    providers.push(
      new GeminiEmbeddingProvider(
        options.geminiApiKey,
        options.geminiModel,
        options.embeddingDimension
      )
    );
  }
  if (options.fallbackProvider) {
    providers.push(options.fallbackProvider);
  }
  if (providers.length === 0) {
    throw new Error("No embedding provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
  }
  return new CompositeEmbeddingProvider(providers, options.embeddingDimension);
};
