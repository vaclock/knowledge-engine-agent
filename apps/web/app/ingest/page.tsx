"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Database, ListTree, Settings2, UploadCloud } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { readAgentConfig, saveAgentConfig } from "../../lib/agent-config";

type ChunkPreview = {
  id: string;
  text: string;
  tokens: string[];
};

export default function IngestPage() {
  const defaultApiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    []
  );
  const [config, setConfig] = useState(() => readAgentConfig(defaultApiBaseUrl));
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [error, setError] = useState("");
  const [selectedChunkId, setSelectedChunkId] = useState("");

  const ingest = async () => {
    if (!content.trim()) return;
    if (!config.embeddingApiKey.trim()) {
      setError("请先在配置中心填写 Embedding API Key（必填）");
      return;
    }
    setLoading(true);
    setError("");
    const fallbackModels =
      config.embeddingFallbackModel && config.embeddingFallbackModel !== config.embeddingModel
        ? [config.embeddingFallbackModel]
        : [];
    try {
      const resp = await fetch(`${config.apiBaseUrl}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          embeddingModel: config.embeddingModel,
          embeddingFallbackModels: fallbackModels,
          embeddingApiKey: config.embeddingApiKey || undefined,
          vectorDbUrl: config.vectorDbUrl || undefined,
          vectorDbCollection: config.vectorDbCollection || undefined,
          vectorDbApiKey: config.vectorDbApiKey || undefined
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        const detail = data.detail ? `：${data.detail}` : "";
        const hint = data.hint ? `（${data.hint}）` : "";
        throw new Error(`${data.error ?? "ingest failed"}${detail}${hint}`);
      }
      setSourceId(data.sourceId ?? "");
      const nextChunks = Array.isArray(data.chunks) ? data.chunks : [];
      setChunks(nextChunks);
      setSelectedChunkId(nextChunks[0]?.id ?? "");
      setContent("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedChunk = chunks.find((chunk) => chunk.id === selectedChunkId) ?? null;

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
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              当前 Embedding：{config.embeddingModel}
              <br />
              Runtime：{config.apiBaseUrl || "未配置"} · 向量库：{config.vectorDbCollection || "未配置"}
            </div>
            <div className="rounded-md border bg-white p-3 text-sm">
              <p className="mb-2 font-medium text-slate-800">检索权重设置</p>
              <label className="mb-2 grid gap-1">
                <span className="text-xs text-slate-600">阈值：{config.retrievalThreshold.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.retrievalThreshold}
                  onChange={(event) => {
                    const next = { ...config, retrievalThreshold: Number(event.target.value) };
                    setConfig(next);
                    saveAgentConfig(next);
                  }}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">混合权重 α：{config.retrievalAlpha.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.retrievalAlpha}
                  onChange={(event) => {
                    const next = { ...config, retrievalAlpha: Number(event.target.value) };
                    setConfig(next);
                    saveAgentConfig(next);
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/config"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                打开配置中心
              </Link>
              <Button variant="outline" onClick={() => setConfig(readAgentConfig(defaultApiBaseUrl))}>
                重新加载配置
              </Button>
            </div>
          </div>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
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
            Chunks 列表
          </CardTitle>
          <CardDescription>点击某个 chunk 查看详情</CardDescription>
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
                <button
                  key={chunk.id}
                  type="button"
                  onClick={() => setSelectedChunkId(chunk.id)}
                  className={`w-full rounded-lg border bg-white p-3 text-left ${
                    selectedChunkId === chunk.id ? "border-blue-400 ring-1 ring-blue-300" : ""
                  }`}
                >
                  <p className="mb-2 text-xs text-slate-500">
                    Chunk #{index + 1} · {chunk.id}
                  </p>
                  <p className="mb-3 line-clamp-3 whitespace-pre-wrap text-sm text-slate-800">
                    {chunk.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {chunk.tokens.map((token) => (
                      <Badge key={`${chunk.id}-${token}`}>{token}</Badge>
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="rounded-md border bg-white p-3">
            <p className="mb-2 text-sm font-medium text-slate-800">Chunk 详情</p>
            {selectedChunk ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p className="text-xs text-slate-500">ID: {selectedChunk.id}</p>
                <p className="whitespace-pre-wrap">{selectedChunk.text}</p>
                <p className="text-xs text-slate-500">Token 数: {selectedChunk.tokens.length}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedChunk.tokens.map((token) => (
                    <Badge key={`detail-${selectedChunk.id}-${token}`}>{token}</Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">请选择一个 chunk 查看详细信息</p>
            )}
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
            <Database className="mr-1 inline h-3.5 w-3.5" />
            数据写入你配置的云端向量数据库后，分词信息仅用于可视化和调试。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
