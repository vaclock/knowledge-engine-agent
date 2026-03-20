export interface AgentConfig {
  apiBaseUrl: string;
  vectorDbUrl: string;
  vectorDbApiKey: string;
  vectorDbCollection: string;
  llmModel: string;
  llmFallbackModels: string;
  llmApiKey: string;
  embeddingModel: string;
  embeddingFallbackModel: string;
  embeddingApiKey: string;
  strictKnowledgeMode: boolean;
  retrievalThreshold: number;
  retrievalAlpha: number;
  enableWebSearch: boolean;
  enableCalculator: boolean;
  enableDateTime: boolean;
}

const STORAGE_KEY = "kea-agent-config-v1";

export const createDefaultAgentConfig = (apiBaseUrl: string): AgentConfig => ({
  apiBaseUrl,
  vectorDbUrl: "",
  vectorDbApiKey: "",
  vectorDbCollection: "knowledge_chunks",
  llmModel: "openai/gpt-4o-mini",
  llmFallbackModels: "google/gemini-1.5-flash",
  llmApiKey: "",
  embeddingModel: "openai/text-embedding-3-small",
  embeddingFallbackModel: "",
  embeddingApiKey: "",
  strictKnowledgeMode: true,
  retrievalThreshold: 0.2,
  retrievalAlpha: 0.8,
  enableWebSearch: true,
  enableCalculator: true,
  enableDateTime: false
});

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

export const readAgentConfig = (defaultApiBaseUrl: string): AgentConfig => {
  const defaults = createDefaultAgentConfig(normalizeBaseUrl(defaultApiBaseUrl));
  if (typeof window === "undefined") {
    return defaults;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    const merged: AgentConfig = {
      ...defaults,
      ...parsed
    };
    return {
      ...merged,
      apiBaseUrl: normalizeBaseUrl(merged.apiBaseUrl || defaults.apiBaseUrl)
    };
  } catch {
    return defaults;
  }
};

export const saveAgentConfig = (config: AgentConfig) => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized: AgentConfig = {
    ...config,
    apiBaseUrl: normalizeBaseUrl(config.apiBaseUrl)
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
};
