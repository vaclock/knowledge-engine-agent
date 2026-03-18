# Knowledge Engine Agent (Monorepo)

系统级 Agent 基础工程，支持：

- 文本上传/输入后进行 chunking + embedding
- embedding provider 支持 OpenAI + Gemini fallback
- embedding 结果写入 Qdrant 向量库
- 问答时优先检索知识库，再交给 LLM 生成回答
- Agent Runtime 内置会话状态存储与上下文压缩
- Agent Runtime 基于 `@vercel/ai` 统一模型调用，支持按请求切换模型与 key
- Agent Runtime 支持 function calling 与 MCP bridge 扩展
- 前端采用 shadcn/ui 风格组件写法
- 前端拆分为独立路由：`/ingest`（知识摄入）与 `/chat`（对话流）
- 上传知识后可返回并展示 chunk 与分词（token）预览

## Monorepo 结构

```txt
apps/
  api/
    src/index.ts      Express API + SSE + Session API
  web/
    app/page.tsx      首页入口（路由导航）
    app/ingest/page.tsx
    app/chat/page.tsx
    components/ui/    shadcn/ui 风格基础组件
    lib/utils.ts
packages/
  agent-runtime/
    src/index.ts      对话编排、上下文压缩、Vercel AI Gateway
  ingestion/
    src/chunking.ts
    src/ingestion-service.ts
    src/scoring.ts
    src/types.ts
    src/providers/    Embedding Providers + Factory
    src/repositories/ Qdrant/InMemory Repository
  markdown-sdk/
    src/index.ts      marked 渲染 + 自定义组件协议
docker-compose.yml    本地 Qdrant
```

## 快速开始

```bash
pnpm install
cp .env.example .env
pnpm dev:qdrant
pnpm dev:api
pnpm dev:web
```

默认地址：

- Web: http://localhost:3000
- API: http://localhost:8080

## 本地 Qdrant（Docker）

```bash
pnpm dev:qdrant
curl http://localhost:6333/collections
```

停止：

```bash
pnpm dev:qdrant:down
```

## API

- `POST /api/ingest`：写入知识并返回 chunks/token 预览
- `POST /api/chat`：非流式问答
- `POST /api/chat/stream`：SSE 流式问答
- `POST /api/session`：创建或获取会话
- `GET /api/session/:sessionId`：读取会话状态
- `DELETE /api/session/:sessionId`：清空会话状态
- `DELETE /api/knowledge`：清空知识库

说明：

- `/api/chat` 与 `/api/chat/stream` 支持传 `sessionId`，未传时后端自动创建
- 前端会将 `sessionId` 存在 localStorage，并在刷新后恢复最近会话消息
- `/api/ingest` 返回 `count` 与 `chunks`，每个 chunk 含 `id`、`text`、`tokens`
- 模型字符串格式：`openai/<model>` 或 `google/<model>`，例如 `openai/gpt-4o-mini`
- `/api/chat` 支持 `model`、`fallbackModels`、`apiKey`，可按请求动态切换
- `/api/ingest` 支持 `embeddingModel`、`embeddingFallbackModels`、`embeddingApiKey`

## 环境变量

必需（二选一或同时配置）：

- `OPENAI_API_KEY`：OpenAI key
- `GEMINI_API_KEY`：Gemini key

可选：

- `PORT`：API 端口，默认 `8080`
- `OPENAI_EMBEDDING_MODEL`：默认 `text-embedding-3-large`
- `OPENAI_CHAT_MODEL`：默认 `gpt-4o-mini`
- `GEMINI_EMBEDDING_MODEL`：默认 `text-embedding-004`
- `GEMINI_CHAT_MODEL`：默认 `gemini-1.5-flash`
- `EMBEDDING_DIMENSION`：统一向量维度，默认 `3072`
- `QDRANT_URL`：默认 `http://localhost:6333`
- `QDRANT_API_KEY`：Qdrant API key（若有）
- `QDRANT_COLLECTION`：默认 `knowledge_chunks`
- `NEXT_PUBLIC_API_BASE_URL`：前端 API 地址，默认 `http://localhost:8080`
