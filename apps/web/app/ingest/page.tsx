"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { Database, ListTree, UploadCloud } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";

type ChunkPreview = {
  id: string;
  text: string;
  tokens: string[];
};

type EmbeddingModelOption = {
  value: string;
  label: string;
  supported: boolean;
};

const EMBEDDING_MODEL_OPTIONS: EmbeddingModelOption[] = [
  {
    value: "openai/text-embedding-3-small",
    label: "OpenAI · text-embedding-3-small",
    supported: true
  },
  {
    value: "openai/text-embedding-3-large",
    label: "OpenAI · text-embedding-3-large",
    supported: true
  },
  {
    value: "google/text-embedding-004",
    label: "Gemini · text-embedding-004",
    supported: true
  },
  {
    value: "anthropic/claude-3-5-sonnet",
    label: "Anthropic · Claude (即将支持)",
    supported: false
  },
  {
    value: "glm/embedding-3",
    label: "GLM · embedding-3 (即将支持)",
    supported: false
  },
  {
    value: "minimax/embedding-01",
    label: "MiniMax · embedding-01 (即将支持)",
    supported: false
  },
  {
    value: "kimi/text-embedding-v1",
    label: "Kimi · text-embedding-v1 (即将支持)",
    supported: false
  }
];

const SUPPORTED_EMBEDDING_MODELS = EMBEDDING_MODEL_OPTIONS.filter((item) => item.supported).map(
  (item) => item.value
);

export default function IngestPage() {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080", []);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [error, setError] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState(
    () =>
      (typeof window !== "undefined" &&
        window.localStorage.getItem("kea-embedding-model")) ||
      "openai/text-embedding-3-small"
  );
  const [embeddingFallbackModel, setEmbeddingFallbackModel] = useState(
    () =>
      (typeof window !== "undefined" &&
        window.localStorage.getItem("kea-embedding-fallback-model")) ||
      "google/text-embedding-004"
  );
  const [embeddingApiKey, setEmbeddingApiKey] = useState(
    () =>
      (typeof window !== "undefined" &&
        window.localStorage.getItem("kea-embedding-api-key")) ||
      ""
  );

  const ingest = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    const fallbackModels =
      embeddingFallbackModel && embeddingFallbackModel !== embeddingModel
        ? [embeddingFallbackModel]
        : [];
    try {
      const resp = await fetch(`${endpoint}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          embeddingModel,
          embeddingFallbackModels: fallbackModels,
          embeddingApiKey: embeddingApiKey || undefined
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error ?? "ingest failed");
      }
      setSourceId(data.sourceId ?? "");
      setChunks(Array.isArray(data.chunks) ? data.chunks : []);
      setContent("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            上传知识库
          </CardTitle>
          <CardDescription>独立于对话流的 ingestion 页面，负责入库与切片分析</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <select
              value={embeddingModel}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value;
                setEmbeddingModel(value);
                window.localStorage.setItem("kea-embedding-model", value);
              }}
              className="flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {EMBEDDING_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} disabled={!option.supported}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={embeddingFallbackModel}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value;
                setEmbeddingFallbackModel(value);
                window.localStorage.setItem("kea-embedding-fallback-model", value);
              }}
              className="flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">不设置备用模型</option>
              {SUPPORTED_EMBEDDING_MODELS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <Input
              type="password"
              value={embeddingApiKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const value = event.target.value;
                setEmbeddingApiKey(value);
                window.localStorage.setItem("kea-embedding-api-key", value);
              }}
              placeholder="Embedding API Key（可选）"
            />
          </div>
          <Textarea
            value={content}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setContent(event.target.value)
            }
            className="min-h-[280px]"
            placeholder="粘贴文本后写入知识库"
          />
          <Button onClick={ingest} disabled={loading || !content.trim()} className="w-full">
            {loading ? "写入中..." : "写入知识库并生成预览"}
          </Button>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="h-5 w-5" />
            Chunks 与分词
          </CardTitle>
          <CardDescription>展示入库后的 chunk 列表与 token 明细</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Source: {sourceId || "未生成"}
          </div>
          <div className="max-h-[440px] space-y-3 overflow-auto pr-1">
            {chunks.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                还没有 chunk 数据，先上传文本
              </div>
            ) : (
              chunks.map((chunk, index) => (
                <div key={chunk.id} className="rounded-lg border bg-white p-3">
                  <p className="mb-2 text-xs text-slate-500">
                    Chunk #{index + 1} · {chunk.id}
                  </p>
                  <p className="mb-3 whitespace-pre-wrap text-sm text-slate-800">{chunk.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {chunk.tokens.map((token) => (
                      <Badge key={`${chunk.id}-${token}`}>{token}</Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
            <Database className="mr-1 inline h-3.5 w-3.5" />
            数据写入 Qdrant 后，分词信息仅用于可视化和调试。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
