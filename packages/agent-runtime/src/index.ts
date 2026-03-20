import type { IngestionService, SearchResult } from "@kea/ingestion";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface FunctionCallContext {
  query: string;
  messages: ChatMessage[];
}

export interface RuntimeFunction {
  name: string;
  description: string;
  execute: (context: FunctionCallContext) => Promise<string>;
}

export interface MCPBridge {
  invoke(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface LLMGateway {
  complete(input: {
    system: string;
    user: string;
    context: string;
    messages: ChatMessage[];
    model?: string;
    fallbackModels?: string[];
    apiKey?: string;
  }): Promise<string>;
}

export interface VercelAIGatewayOptions {
  defaultModels?: string[];
  openAIApiKey?: string;
  googleApiKey?: string;
  gatewayApiKey?: string;
  gatewayBaseUrl?: string;
}

export interface ConversationState {
  sessionId: string;
  summary: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ConversationStore {
  get(sessionId: string): Promise<ConversationState | null>;
  upsert(state: ConversationState): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export class InMemoryConversationStore implements ConversationStore {
  private readonly sessions = new Map<string, ConversationState>();

  async get(sessionId: string): Promise<ConversationState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async upsert(state: ConversationState): Promise<void> {
    this.sessions.set(state.sessionId, state);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export class MockLLMGateway implements LLMGateway {
  async complete(input: { system: string; user: string; context: string }) {
    return `【演示回答】\n${input.system}\n\n基于上下文回答：\n${input.context || "暂无知识库命中"}\n\n用户问题：${input.user}`;
  }
}

export class VercelAILLMGateway implements LLMGateway {
  private readonly defaultModels: string[];

  constructor(options: VercelAIGatewayOptions) {
    this.defaultModels = options.defaultModels ?? [];
    this.openAIApiKey = options.openAIApiKey;
    this.googleApiKey = options.googleApiKey;
    this.gatewayApiKey = options.gatewayApiKey;
    this.gatewayBaseUrl = options.gatewayBaseUrl ?? "https://ai-gateway.vercel.sh/v1";
  }

  private readonly openAIApiKey?: string;
  private readonly googleApiKey?: string;
  private readonly gatewayApiKey?: string;
  private readonly gatewayBaseUrl: string;

  private resolveModel(ref: string, runtimeApiKey?: string): LanguageModel {
    const [provider, ...rest] = ref.split("/");
    const modelName = rest.join("/").trim();
    if (!provider || !modelName) {
      throw new Error(`invalid_model_ref:${ref}`);
    }
    if (provider === "openai") {
      const apiKey = runtimeApiKey ?? this.openAIApiKey;
      if (!apiKey) throw new Error("openai_not_configured");
      const openai = createOpenAI({ apiKey });
      return openai(modelName);
    }
    if (provider === "google" || provider === "gemini") {
      const apiKey = runtimeApiKey ?? this.googleApiKey;
      if (!apiKey) throw new Error("google_not_configured");
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelName);
    }
    const gatewayApiKey = runtimeApiKey ?? this.gatewayApiKey;
    if (!gatewayApiKey) throw new Error(`unsupported_provider_without_gateway_key:${provider}`);
    const gateway = createOpenAI({
      apiKey: gatewayApiKey,
      baseURL: this.gatewayBaseUrl
    });
    return gateway(ref);
  }

  private async runModel(model: LanguageModel, input: { system: string; user: string; context: string }) {
    const result = await generateText({
      model,
      system: input.system,
      prompt: `${input.context}\n\n[用户问题]\n${input.user}`
    });
    return result.text;
  }

  async complete(input: {
    system: string;
    user: string;
    context: string;
    messages: ChatMessage[];
    model?: string;
    fallbackModels?: string[];
    apiKey?: string;
  }): Promise<string> {
    const modelRefs = [
      ...(input.model ? [input.model] : []),
      ...(input.fallbackModels ?? []),
      ...this.defaultModels
    ];
    if (modelRefs.length === 0) {
      throw new Error("llm_not_configured");
    }
    const errors: string[] = [];
    for (const modelRef of modelRefs) {
      try {
        const model = this.resolveModel(modelRef, input.apiKey);
        return await this.runModel(model, input);
      } catch (error) {
        errors.push(String(error));
      }
    }
    throw new Error(`llm_all_failed:${errors.join(";")}`);
  }
}

export class AgentRuntime {
  private readonly functions = new Map<string, RuntimeFunction>();
  private readonly maxRecentMessages = 10;
  private readonly summaryMaxChars = 2000;

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly llmGateway: LLMGateway,
    private readonly mcpBridge?: MCPBridge,
    private readonly conversationStore?: ConversationStore
  ) {}

  registerFunction(func: RuntimeFunction) {
    this.functions.set(func.name, func);
  }

  private compactState(state: ConversationState) {
    if (state.messages.length <= this.maxRecentMessages) return state;
    const overflow = state.messages.slice(0, state.messages.length - this.maxRecentMessages);
    const recent = state.messages.slice(-this.maxRecentMessages);
    const deltaSummary = overflow
      .map((msg) => `${msg.role}: ${msg.content.slice(0, 240)}`)
      .join("\n");
    const summary = `${state.summary}\n${deltaSummary}`.trim().slice(-this.summaryMaxChars);
    return {
      ...state,
      summary,
      messages: recent
    };
  }

  async getSession(sessionId: string) {
    if (!this.conversationStore) return null;
    return this.conversationStore.get(sessionId);
  }

  async clearSession(sessionId: string) {
    if (!this.conversationStore) return;
    await this.conversationStore.delete(sessionId);
  }

  async ask(input: {
    sessionId: string;
    query: string;
    messages?: ChatMessage[];
    threshold?: number;
    alpha?: number;
    model?: string;
    fallbackModels?: string[];
    apiKey?: string;
  }) {
    const persisted = this.conversationStore
      ? await this.conversationStore.get(input.sessionId)
      : null;
    const baseMessages = persisted?.messages ?? input.messages ?? [];
    const state: ConversationState = {
      sessionId: input.sessionId,
      summary: persisted?.summary ?? "",
      messages: [...baseMessages, { role: "user", content: input.query }],
      updatedAt: Date.now()
    };

    let retrieval: SearchResult[] = [];
    let retrievalError = "";
    try {
      retrieval = await this.ingestionService.retrieve(
        input.query,
        4,
        input.threshold ?? 0.15,
        input.alpha ?? 0.8
      );
    } catch (error) {
      retrievalError = `检索失败：${String(error)}`;
    }
    const context = retrieval
      .map(
        (chunk: SearchResult, index: number) =>
          `[片段${index + 1}][score=${chunk.score.toFixed(3)}]\n${chunk.text}`
      )
      .join("\n\n");

    const lower = input.query.toLowerCase();
    let toolOutput = "";
    for (const func of this.functions.values()) {
      if (lower.includes(func.name.toLowerCase())) {
        toolOutput = await func.execute({ query: input.query, messages: state.messages });
      }
    }

    if (this.mcpBridge && lower.includes("mcp:")) {
      const [, command = ""] = input.query.split("mcp:");
      const [serverName, toolName] = command.trim().split("/");
      if (serverName && toolName) {
        const mcpResult = await this.mcpBridge.invoke(serverName, toolName, {});
        toolOutput += `\nMCP结果: ${JSON.stringify(mcpResult)}`;
      }
    }

    const systemPrompt =
      "你是系统级 Agent。严格优先依据知识库上下文回答，若无命中明确说明。支持 function calling 与 MCP 的工具结果融合。";

    const memoryContext = state.summary
      ? `[历史对话摘要]\n${state.summary}\n\n[最近会话消息]\n${state.messages
          .slice(-6)
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join("\n")}`
      : "";

    const answer = await this.llmGateway.complete({
      system: systemPrompt,
      user: input.query,
      context: `${memoryContext}\n\n${context}\n${toolOutput}\n${retrievalError}`.trim(),
      messages: state.messages,
      model: input.model,
      fallbackModels: input.fallbackModels,
      apiKey: input.apiKey
    });

    state.messages.push({ role: "assistant", content: answer });
    const compacted = this.compactState({
      ...state,
      updatedAt: Date.now()
    });
    if (this.conversationStore) {
      await this.conversationStore.upsert(compacted);
    }

    return {
      sessionId: input.sessionId,
      answer,
      retrieval: retrieval.map((item) => ({
        id: item.id,
        sourceId: item.sourceId,
        text: item.text,
        score: item.score
      })),
      state: {
        summary: compacted.summary,
        recentMessages: compacted.messages.length,
        updatedAt: compacted.updatedAt
      }
    };
  }
}
