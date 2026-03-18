"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { createMarkdownRenderer, weatherCardRenderer } from "@kea/markdown-sdk";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

type Message = { role: "user" | "assistant"; content: string };

const renderer = createMarkdownRenderer({
  components: {
    WeatherCard: weatherCardRenderer as (props: Record<string, unknown>) => string
  }
});

export default function ChatPage() {
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080", []);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [fallbackModels, setFallbackModels] = useState("google/gemini-1.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("openai/text-embedding-3-small");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");

  useEffect(() => {
    const savedModel = window.localStorage.getItem("kea-chat-model");
    const savedFallback = window.localStorage.getItem("kea-chat-fallback-models");
    const savedApiKey = window.localStorage.getItem("kea-chat-api-key");
    const savedEmbeddingModel = window.localStorage.getItem("kea-embedding-model");
    const savedEmbeddingApiKey = window.localStorage.getItem("kea-embedding-api-key");
    if (savedModel) setModel(savedModel);
    if (savedFallback) setFallbackModels(savedFallback);
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedEmbeddingModel) setEmbeddingModel(savedEmbeddingModel);
    if (savedEmbeddingApiKey) setEmbeddingApiKey(savedEmbeddingApiKey);

    const bootstrap = async () => {
      try {
        setNetworkError("");
        const saved = window.localStorage.getItem("kea-session-id");
        if (saved) {
          setSessionId(saved);
          const stateResp = await fetch(`${endpoint}/api/session/${saved}`);
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
        const resp = await fetch(`${endpoint}/api/session`, { method: "POST" });
        const data = await resp.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          window.localStorage.setItem("kea-session-id", data.sessionId);
        }
      } catch {
        setNetworkError("无法连接后端，请先启动 API（默认 http://localhost:8080）");
      }
    };
    void bootstrap();
  }, [endpoint]);

  const clearSession = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${endpoint}/api/session/${sessionId}`, { method: "DELETE" });
      const resp = await fetch(`${endpoint}/api/session`, { method: "POST" });
      const data = await resp.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        window.localStorage.setItem("kea-session-id", data.sessionId);
      }
      setMessages([]);
      setNetworkError("");
    } catch {
      setNetworkError("清理会话失败，请检查 API 服务状态");
    }
  };

  const ask = async () => {
    if (!query.trim() || !sessionId || loading) return;
    const current = query.trim();
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: current }]);
    setLoading(true);
    try {
      const normalizedFallbackModels = fallbackModels
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const resp = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query: current,
          model,
          fallbackModels: normalizedFallbackModels,
          apiKey: apiKey || undefined,
          embeddingModel,
          embeddingApiKey: embeddingApiKey || undefined
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
        { role: "assistant", content: "网络异常：无法连接后端 API，请确认服务已启动。" }
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
      <CardContent className="grid h-[calc(100%-5.5rem)] grid-rows-[1fr_auto] gap-3">
        <div className="grid gap-2 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
          <Input
            value={model}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setModel(value);
              window.localStorage.setItem("kea-chat-model", value);
            }}
            placeholder="聊天模型，如 openai/gpt-4o-mini"
          />
          <Input
            value={fallbackModels}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setFallbackModels(value);
              window.localStorage.setItem("kea-chat-fallback-models", value);
            }}
            placeholder="备用模型，逗号分隔"
          />
          <Input
            type="password"
            value={apiKey}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setApiKey(value);
              window.localStorage.setItem("kea-chat-api-key", value);
            }}
            placeholder="聊天 API Key（可选，覆盖服务端默认）"
          />
          <Input
            value={embeddingModel}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setEmbeddingModel(value);
              window.localStorage.setItem("kea-embedding-model", value);
            }}
            placeholder="Embedding 模型，如 openai/text-embedding-3-small"
          />
          <Input
            type="password"
            value={embeddingApiKey}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value = event.target.value;
              setEmbeddingApiKey(value);
              window.localStorage.setItem("kea-embedding-api-key", value);
            }}
            placeholder="Embedding API Key（可选）"
            className="md:col-span-2"
          />
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
