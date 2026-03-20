"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Send, Settings2, Trash2 } from "lucide-react";
import { createMarkdownRenderer, weatherCardRenderer } from "@kea/markdown-sdk";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { readAgentConfig } from "../../lib/agent-config";

type Message = { role: "user" | "assistant"; content: string };

const renderer = createMarkdownRenderer({
  components: {
    WeatherCard: weatherCardRenderer as (props: Record<string, unknown>) => string
  }
});

export default function ChatPage() {
  const defaultApiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    []
  );
  const [config, setConfig] = useState(() => readAgentConfig(defaultApiBaseUrl));
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState("");

  useEffect(() => {
    const nextConfig = readAgentConfig(defaultApiBaseUrl);
    setConfig(nextConfig);

    const bootstrap = async () => {
      try {
        setNetworkError("");
        const saved = window.localStorage.getItem("kea-session-id");
        if (saved) {
          setSessionId(saved);
          const stateResp = await fetch(`${nextConfig.apiBaseUrl}/api/session/${saved}`);
          if (stateResp.ok) {
            const state = await stateResp.json();
            const restored = Array.isArray(state.messages)
              ? state.messages.filter(
                  (msg: { role?: string; content?: string }) =>
                    (msg.role === "user" || msg.role === "assistant") &&
                    typeof msg.content === "string"
                )
              : [];
            setMessages(restored);
            return;
          }
        }
        const resp = await fetch(`${nextConfig.apiBaseUrl}/api/session`, { method: "POST" });
        const data = await resp.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          window.localStorage.setItem("kea-session-id", data.sessionId);
        }
      } catch {
        setNetworkError("无法连接后端，请先检查配置中心中的 Runtime 地址");
      }
    };
    void bootstrap();
  }, [defaultApiBaseUrl]);

  const clearSession = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${config.apiBaseUrl}/api/session/${sessionId}`, { method: "DELETE" });
      const resp = await fetch(`${config.apiBaseUrl}/api/session`, { method: "POST" });
      const data = await resp.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        window.localStorage.setItem("kea-session-id", data.sessionId);
      }
      setMessages([]);
      setNetworkError("");
    } catch {
      setNetworkError("清理会话失败，请检查配置中心中的 Runtime 服务状态");
    }
  };

  const ask = async () => {
    if (!query.trim() || !sessionId || loading) return;
    if (!config.llmApiKey.trim()) {
      setNetworkError("请先在配置中心填写 LLM API Key（必填）");
      return;
    }
    if (!config.embeddingApiKey.trim()) {
      setNetworkError("请先在配置中心填写 Embedding API Key（必填）");
      return;
    }
    const current = query.trim();
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: current }]);
    setLoading(true);
    try {
      const normalizedFallbackModels = config.llmFallbackModels
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const embeddingFallbackModels =
        config.embeddingFallbackModel && config.embeddingFallbackModel !== config.embeddingModel
          ? [config.embeddingFallbackModel]
          : [];
      const resp = await fetch(`${config.apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query: current,
          threshold: config.strictKnowledgeMode ? config.retrievalThreshold : 0,
          alpha: config.retrievalAlpha,
          model: config.llmModel,
          fallbackModels: normalizedFallbackModels,
          apiKey: config.llmApiKey || undefined,
          embeddingModel: config.embeddingModel,
          embeddingFallbackModels,
          embeddingApiKey: config.embeddingApiKey || undefined,
          vectorDbUrl: config.vectorDbUrl || undefined,
          vectorDbCollection: config.vectorDbCollection || undefined,
          vectorDbApiKey: config.vectorDbApiKey || undefined
        })
      });
      const data = await resp.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer ?? `请求失败：${data.error ?? "unknown error"}` }
      ]);
      setNetworkError("");
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络异常：无法连接后端 API，请先检查配置中心。" }
      ]);
      setNetworkError("请求失败：后端不可达");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-8rem)]">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            对话流
          </CardTitle>
          <CardDescription>独立会话路由，自动维护上下文状态</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge>Session: {sessionId ? sessionId.slice(0, 12) : "初始化中"}</Badge>
          <Button variant="destructive" size="sm" onClick={clearSession}>
            <Trash2 className="mr-1 h-4 w-4" />
            清空会话
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid h-[calc(100%-5.5rem)] grid-rows-[auto_1fr_auto] gap-3">
        <div className="grid gap-2 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
          <div className="rounded-md bg-white p-3 text-xs text-slate-600 md:col-span-2">
            当前模型：{config.llmModel} · Embedding：{config.embeddingModel}
            <br />
            Runtime：{config.apiBaseUrl || "未配置"} · 向量库：{config.vectorDbCollection || "未配置"}
          </div>
          <Link
            href="/config"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            打开配置中心
          </Link>
          <Button
            variant="outline"
            onClick={() => setConfig(readAgentConfig(defaultApiBaseUrl))}
            className="md:justify-start"
          >
            重新加载配置
          </Button>
        </div>
        <div className="space-y-3 overflow-auto pr-1">
          {networkError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              {networkError}
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">
              暂无消息，输入一个问题开始。
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`rounded-lg border p-3 text-sm leading-6 ${
                  message.role === "assistant" ? "bg-slate-50" : "bg-blue-50"
                }`}
                dangerouslySetInnerHTML={{ __html: renderer.render(message.content) }}
              />
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="输入问题，例如：我刚才上传的文档要点是什么？"
          />
          <Button onClick={ask} disabled={loading || !query.trim() || !sessionId} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
