import "dotenv/config";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
  AgentRuntime,
  InMemoryConversationStore,
  MockLLMGateway,
  VercelAILLMGateway,
  type MCPBridge
} from "@kea/agent-runtime";
import { createEmbeddingProvider, IngestionService, QdrantVectorRepository } from "@kea/ingestion";
import { listQdrantCollections } from "./qdrant-client.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const mcpBridge: MCPBridge = {
  async invoke(serverName, toolName, args) {
    return { ok: true, serverName, toolName, args };
  }
};

const conversationStore = new InMemoryConversationStore();

const createRuntimeContext = (options?: {
  model?: string;
  fallbackModels?: string[];
  apiKey?: string;
  embeddingModel?: string;
  embeddingFallbackModels?: string[];
  embeddingApiKey?: string;
  vectorDbUrl?: string;
  vectorDbApiKey?: string;
  vectorDbCollection?: string;
  vectorDimension?: number;
}) => {
  const repository = new QdrantVectorRepository(
    {
      url: options?.vectorDbUrl ?? process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: options?.vectorDbApiKey ?? process.env.QDRANT_API_KEY
    },
    options?.vectorDbCollection ?? process.env.QDRANT_COLLECTION ?? "knowledge_chunks",
    options?.vectorDimension ?? Number(process.env.EMBEDDING_DIMENSION ?? 3072)
  );
  const shouldUseDefaultEmbeddingModels =
    !options?.embeddingModel && (!options?.embeddingFallbackModels || options.embeddingFallbackModels.length === 0);
  const defaultEmbeddingModels: string[] = [];
  if (shouldUseDefaultEmbeddingModels && process.env.OPENAI_API_KEY) {
    defaultEmbeddingModels.push(
      `openai/${process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large"}`
    );
  }
  if (shouldUseDefaultEmbeddingModels && process.env.GEMINI_API_KEY) {
    defaultEmbeddingModels.push(
      `google/${process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004"}`
    );
  }
  const embedding = createEmbeddingProvider({
    model: options?.embeddingModel,
    fallbackModels: options?.embeddingFallbackModels,
    apiKey: options?.embeddingApiKey,
    gatewayApiKey: options?.embeddingApiKey,
    gatewayBaseUrl: process.env.VERCEL_AI_GATEWAY_BASE_URL,
    defaultModels: defaultEmbeddingModels,
    openAIApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    embeddingDimension: options?.vectorDimension ?? Number(process.env.EMBEDDING_DIMENSION ?? 3072)
  });
  const ingestion = new IngestionService(embedding, repository);
  const llmGateway =
    process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || options?.apiKey
      ? new VercelAILLMGateway({
          defaultModels: [
            `openai/${process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini"}`,
            `google/${process.env.GEMINI_CHAT_MODEL ?? "gemini-1.5-flash"}`
          ],
          openAIApiKey: process.env.OPENAI_API_KEY,
          googleApiKey: process.env.GEMINI_API_KEY,
          gatewayApiKey: process.env.VERCEL_AI_GATEWAY_API_KEY,
          gatewayBaseUrl: process.env.VERCEL_AI_GATEWAY_BASE_URL
        })
      : new MockLLMGateway();
  const runtime = new AgentRuntime(ingestion, llmGateway, mcpBridge, conversationStore);
  runtime.registerFunction({
    name: "time",
    description: "返回当前时间",
    async execute() {
      return `当前时间: ${new Date().toISOString()}`;
    }
  });
  return { runtime, ingestion };
};

const vectorStoreSchema = z.object({
  vectorDbUrl: z.string().url().optional(),
  vectorDbApiKey: z.string().min(1).optional(),
  vectorDbCollection: z.string().min(1).optional(),
  vectorDimension: z.number().int().min(1).max(8192).optional()
});

const ingestSchema = z.object({
  sourceId: z.string().min(1).optional(),
  content: z.string().min(1),
  embeddingModel: z.string().min(1).optional(),
  embeddingFallbackModels: z.array(z.string().min(1)).optional(),
  embeddingApiKey: z.string().min(1)
}).merge(vectorStoreSchema);

const chatSchema = z.object({
  sessionId: z.string().min(1).optional(),
  query: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string()
      })
    )
    .default([]),
  threshold: z.number().min(0).max(1).optional(),
  alpha: z.number().min(0).max(1).optional(),
  model: z.string().min(1).optional(),
  fallbackModels: z.array(z.string().min(1)).optional(),
  apiKey: z.string().min(1),
  embeddingModel: z.string().min(1).optional(),
  embeddingFallbackModels: z.array(z.string().min(1)).optional(),
  embeddingApiKey: z.string().min(1)
}).merge(vectorStoreSchema);

const sessionSchema = z.object({
  sessionId: z.string().min(1).optional()
});

const vectorDbTestSchema = z.object({
  vectorDbUrl: z.string().url(),
  vectorDbApiKey: z.string().min(1).optional()
});

const readSessionParam = (req: Request) => {
  const raw = req.params.sessionId;
  return Array.isArray(raw) ? raw[0] : raw;
};

app.post("/api/ingest", async (req: Request, res: Response) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const sourceId = parsed.data.sourceId ?? `doc-${randomUUID()}`;
    const { ingestion } = createRuntimeContext({
      embeddingModel: parsed.data.embeddingModel,
      embeddingFallbackModels: parsed.data.embeddingFallbackModels,
      embeddingApiKey: parsed.data.embeddingApiKey,
      vectorDbUrl: parsed.data.vectorDbUrl,
      vectorDbApiKey: parsed.data.vectorDbApiKey,
      vectorDbCollection: parsed.data.vectorDbCollection,
      vectorDimension: parsed.data.vectorDimension
    });
    const result = await ingestion.ingest(sourceId, parsed.data.content);
    return res.json({ sourceId, chunks: result.chunks, count: result.count });
  } catch (error) {
    const detail = String(error);
    const hint = detail.includes("Connect Timeout Error")
      ? "embedding_provider_timeout：请切换到可达的 Embedding 模型，或在配置中移除不可达的备用模型"
      : undefined;
    return res.status(502).json({ error: "ingest_failed", detail, hint });
  }
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const { runtime } = createRuntimeContext({
      model: parsed.data.model,
      fallbackModels: parsed.data.fallbackModels,
      apiKey: parsed.data.apiKey,
      embeddingModel: parsed.data.embeddingModel,
      embeddingFallbackModels: parsed.data.embeddingFallbackModels,
      embeddingApiKey: parsed.data.embeddingApiKey,
      vectorDbUrl: parsed.data.vectorDbUrl,
      vectorDbApiKey: parsed.data.vectorDbApiKey,
      vectorDbCollection: parsed.data.vectorDbCollection,
      vectorDimension: parsed.data.vectorDimension
    });
    const result = await runtime.ask({
      ...parsed.data,
      sessionId: parsed.data.sessionId ?? `session-${randomUUID()}`,
      threshold: parsed.data.threshold,
      alpha: parsed.data.alpha,
      model: parsed.data.model,
      fallbackModels: parsed.data.fallbackModels,
      apiKey: parsed.data.apiKey
    });
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: "chat_failed", detail: String(error) });
  }
});

app.post("/api/chat/stream", async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { runtime } = createRuntimeContext({
      model: parsed.data.model,
      fallbackModels: parsed.data.fallbackModels,
      apiKey: parsed.data.apiKey,
      embeddingModel: parsed.data.embeddingModel,
      embeddingFallbackModels: parsed.data.embeddingFallbackModels,
      embeddingApiKey: parsed.data.embeddingApiKey,
      vectorDbUrl: parsed.data.vectorDbUrl,
      vectorDbApiKey: parsed.data.vectorDbApiKey,
      vectorDbCollection: parsed.data.vectorDbCollection,
      vectorDimension: parsed.data.vectorDimension
    });
    const result = await runtime.ask({
      ...parsed.data,
      sessionId: parsed.data.sessionId ?? `session-${randomUUID()}`,
      threshold: parsed.data.threshold,
      alpha: parsed.data.alpha,
      model: parsed.data.model,
      fallbackModels: parsed.data.fallbackModels,
      apiKey: parsed.data.apiKey
    });
    res.write(`event: answer\n`);
    res.write(`data: ${JSON.stringify(result)}\n\n`);
    res.write(`event: done\n`);
    res.write(`data: {}\n\n`);
    res.end();
  } catch (error) {
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: "chat_failed", detail: String(error) })}\n\n`);
    res.end();
  }
});

app.post("/api/session", async (req: Request, res: Response) => {
  const parsed = sessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const sessionId = parsed.data.sessionId ?? `session-${randomUUID()}`;
  const existing = await conversationStore.get(sessionId);
  if (!existing) {
    await conversationStore.upsert({
      sessionId,
      summary: "",
      messages: [],
      updatedAt: Date.now()
    });
  }
  return res.json({ sessionId });
});

app.post("/api/vector-db/test", async (req: Request, res: Response) => {
  const parsed = vectorDbTestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const collections = await listQdrantCollections({
      url: parsed.data.vectorDbUrl,
      apiKey: parsed.data.vectorDbApiKey
    });
    return res.json({ ok: true, collections });
  } catch (error) {
    return res.status(502).json({ ok: false, error: "vector_db_test_failed", detail: String(error) });
  }
});

app.get("/api/session/:sessionId", async (req: Request, res: Response) => {
  const sessionId = readSessionParam(req);
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }
  const state = await conversationStore.get(sessionId);
  if (!state) {
    return res.status(404).json({ error: "session not found" });
  }
  return res.json({
    sessionId: state.sessionId,
    summary: state.summary,
    messages: state.messages,
    updatedAt: state.updatedAt
  });
});

app.delete("/api/session/:sessionId", async (req: Request, res: Response) => {
  const sessionId = readSessionParam(req);
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }
  await conversationStore.delete(sessionId);
  return res.json({ ok: true });
});

app.delete("/api/knowledge", async (_req: Request, res: Response) => {
  const parsed = vectorStoreSchema.safeParse(_req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const repository = new QdrantVectorRepository(
    {
      url: parsed.data.vectorDbUrl ?? process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: parsed.data.vectorDbApiKey ?? process.env.QDRANT_API_KEY
    },
    parsed.data.vectorDbCollection ?? process.env.QDRANT_COLLECTION ?? "knowledge_chunks",
    parsed.data.vectorDimension ?? Number(process.env.EMBEDDING_DIMENSION ?? 3072)
  );
  await repository.clear();
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
