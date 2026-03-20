"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Settings2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { readAgentConfig, saveAgentConfig } from "../../lib/agent-config";

type ModelGroup = {
  label: string;
  options: string[];
};

const LLM_GROUPS = [
  {
    label: "OpenAI",
    options: ["openai/gpt-4o-mini", "openai/gpt-4.1-mini", "openai/gpt-4.1"]
  },
  {
    label: "Google Gemini",
    options: ["google/gemini-1.5-flash", "google/gemini-2.0-flash", "google/gemini-2.0-pro"]
  },
  {
    label: "Anthropic",
    options: ["anthropic/claude-3-5-sonnet", "anthropic/claude-3-7-sonnet"]
  },
  {
    label: "国内模型",
    options: ["minimax/minimax-m2", "moonshotai/kimi-k2", "zhipu/glm-4.5"]
  }
];

const EMBEDDING_GROUPS = [
  {
    label: "OpenAI",
    options: ["openai/text-embedding-3-small", "openai/text-embedding-3-large"]
  },
  {
    label: "Google Gemini",
    options: ["google/text-embedding-004"]
  },
  {
    label: "国内模型",
    options: ["zhipu/embedding-3", "minimax/embedding-01"]
  }
];

type SearchableModelSelectProps = {
  value: string;
  groups: ModelGroup[];
  onChange: (value: string) => void;
  placeholder: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

function SearchableModelSelect({
  value,
  groups,
  onChange,
  placeholder,
  allowEmpty = false,
  emptyLabel = "不设置"
}: SearchableModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const allOptions = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selectedExists = !value || allOptions.includes(value);
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.toLowerCase().includes(q))
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectValue = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="truncate text-left">{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-xl border bg-white shadow-lg">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模型..."
                className="h-9 w-full rounded-md border bg-slate-50 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto p-2">
            {allowEmpty ? (
              <button
                type="button"
                onClick={() => selectValue("")}
                className={`mb-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 ${
                  value === "" ? "bg-blue-50 text-blue-700" : ""
                }`}
              >
                <span>{emptyLabel}</span>
                {value === "" ? <Check className="h-4 w-4" /> : null}
              </button>
            ) : null}
            {!selectedExists && value ? (
              <button
                type="button"
                onClick={() => selectValue(value)}
                className="mb-1 flex w-full items-center justify-between rounded-md bg-blue-50 px-2 py-2 text-left text-sm text-blue-700"
              >
                <span>{`${value}（当前值）`}</span>
                <Check className="h-4 w-4" />
              </button>
            ) : null}
            {visibleGroups.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-slate-500">没有匹配的模型</p>
            ) : (
              visibleGroups.map((group) => (
                <div key={group.label} className="mb-2">
                  <p className="px-2 py-1 text-xs font-medium text-slate-500">{group.label}</p>
                  {group.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectValue(option)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100 ${
                        option === value ? "bg-blue-50 text-blue-700" : ""
                      }`}
                    >
                      <span className="truncate">{option}</span>
                      {option === value ? <Check className="h-4 w-4" /> : null}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ConfigPage() {
  const defaultApiBaseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    []
  );
  const [config, setConfig] = useState(() => readAgentConfig(defaultApiBaseUrl));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testingVectorDb, setTestingVectorDb] = useState(false);
  const [vectorDbTestResult, setVectorDbTestResult] = useState("");
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");

  const updateField = <K extends keyof typeof config>(key: K, value: (typeof config)[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved("");
    setSaveError("");
  };

  const onSave = () => {
    if (!config.llmApiKey.trim()) {
      setSaveError("LLM API Key 为必填");
      return;
    }
    if (!config.embeddingApiKey.trim()) {
      setSaveError("Embedding API Key 为必填");
      return;
    }
    setSaveError("");
    saveAgentConfig(config);
    setSaved("配置已保存到浏览器");
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult("");
    try {
      const resp = await fetch(`${config.apiBaseUrl}/api/session`, { method: "POST" });
      const data = await resp.json();
      if (resp.ok && data.sessionId) {
        setTestResult("连接成功，Agent Runtime 可用");
      } else {
        setTestResult(`连接失败：${data.error ?? "unknown error"}`);
      }
    } catch (error) {
      setTestResult(`连接失败：${String(error)}`);
    } finally {
      setTesting(false);
    }
  };

  const testVectorDbConnection = async () => {
    if (!config.vectorDbUrl.trim()) {
      setVectorDbTestResult("请先填写向量数据库 URL");
      return;
    }
    setTestingVectorDb(true);
    setVectorDbTestResult("");
    try {
      const resp = await fetch(`${config.apiBaseUrl}/api/vector-db/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vectorDbUrl: config.vectorDbUrl,
          vectorDbApiKey: config.vectorDbApiKey || undefined
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        setVectorDbTestResult(`连接失败：${data.detail ?? data.error ?? "unknown error"}`);
        return;
      }
      const collectionNames = Array.isArray(data.collections) ? data.collections.join(", ") : "";
      setVectorDbTestResult(
        collectionNames ? `连接成功，集合：${collectionNames}` : "连接成功，当前没有集合"
      );
    } catch (error) {
      setVectorDbTestResult(`连接失败：${String(error)}`);
    } finally {
      setTestingVectorDb(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Agent 配置
          </CardTitle>
          <CardDescription>配置模型、API Key 与运行时服务地址，保存到浏览器本地存储</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Runtime 服务</h3>
            <Input
              value={config.apiBaseUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("apiBaseUrl", event.target.value)
              }
              placeholder="Agent Runtime 地址，如 http://localhost:8080"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? "测试中..." : "测试连接"}
              </Button>
              {testResult ? <p className="text-sm text-slate-600">{testResult}</p> : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">数据库配置</h3>
            <Input
              value={config.vectorDbUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("vectorDbUrl", event.target.value)
              }
              placeholder="向量数据库 URL，如 https://xxx.cloud.qdrant.io:6333"
            />
            <Input
              value={config.vectorDbCollection}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("vectorDbCollection", event.target.value)
              }
              placeholder="表/集合名，如 knowledge_chunks"
            />
            <Input
              type="password"
              value={config.vectorDbApiKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("vectorDbApiKey", event.target.value)
              }
              placeholder="向量数据库 API Key（可选）"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={testVectorDbConnection} disabled={testingVectorDb}>
                {testingVectorDb ? "测试中..." : "测试向量库连接"}
              </Button>
              {vectorDbTestResult ? <p className="text-sm text-slate-600">{vectorDbTestResult}</p> : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">模型设置</h3>
            <SearchableModelSelect
              value={config.llmModel}
              groups={LLM_GROUPS}
              onChange={(value) => updateField("llmModel", value)}
              placeholder="请选择 LLM 模型"
            />
            <Input
              value={config.llmFallbackModels}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("llmFallbackModels", event.target.value)
              }
              placeholder="LLM 备用模型，逗号分隔"
            />
            <Input
              type="password"
              value={config.llmApiKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("llmApiKey", event.target.value)
              }
              placeholder="LLM API Key（必填）"
            />
            <SearchableModelSelect
              value={config.embeddingModel}
              groups={EMBEDDING_GROUPS}
              onChange={(value) => updateField("embeddingModel", value)}
              placeholder="请选择 Embedding 模型"
            />
            <SearchableModelSelect
              value={config.embeddingFallbackModel}
              groups={EMBEDDING_GROUPS}
              onChange={(value) => updateField("embeddingFallbackModel", value)}
              placeholder="请选择 Embedding 备用模型"
              allowEmpty
              emptyLabel="不设置备用模型"
            />
            <p className="text-xs text-slate-500">下拉选择后会自动更新对应的 model 参数值</p>
            <Input
              type="password"
              value={config.embeddingApiKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateField("embeddingApiKey", event.target.value)
              }
              placeholder="Embedding API Key（必填）"
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">行为</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.strictKnowledgeMode}
                onChange={(event) => updateField("strictKnowledgeMode", event.target.checked)}
              />
              严格知识库模式
            </label>
            <div className="grid gap-2 text-sm">
              <label className="grid gap-1">
                <span>检索阈值：{config.retrievalThreshold.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.retrievalThreshold}
                  onChange={(event) => updateField("retrievalThreshold", Number(event.target.value))}
                />
              </label>
              <label className="grid gap-1">
                <span>混合检索权重 α：{config.retrievalAlpha.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={config.retrievalAlpha}
                  onChange={(event) => updateField("retrievalAlpha", Number(event.target.value))}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.enableWebSearch}
                  onChange={(event) => updateField("enableWebSearch", event.target.checked)}
                />
                启用 Web Search
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.enableCalculator}
                  onChange={(event) => updateField("enableCalculator", event.target.checked)}
                />
                启用 Calculator
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.enableDateTime}
                  onChange={(event) => updateField("enableDateTime", event.target.checked)}
                />
                启用 Date/Time Context
              </label>
            </div>
          </section>

          <div className="space-y-2">
            <Button onClick={onSave} className="w-full">
              保存配置
            </Button>
            {saveError ? <p className="text-center text-sm text-rose-600">{saveError}</p> : null}
            {saved ? <p className="text-center text-sm text-emerald-600">{saved}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
