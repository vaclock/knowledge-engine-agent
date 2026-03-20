import Link from "next/link";
import { MessageSquare, Settings2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export default function HomePage() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link href="/ingest">
        <Card className="h-full transition hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              上传知识库
            </CardTitle>
            <CardDescription>独立页面进行文本上传、切片、分词预览与向量入库</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            上传后可查看每个 chunk 的内容与 token 列表，不与对话流耦合。
          </CardContent>
        </Card>
      </Link>
      <Link href="/chat">
        <Card className="h-full transition hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              对话流
            </CardTitle>
            <CardDescription>独立会话页面，专注检索问答与上下文状态管理</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            页面自动维护 sessionId，并可在刷新后恢复最近对话上下文。
          </CardContent>
        </Card>
      </Link>
      <Link href="/config">
        <Card className="h-full transition hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Agent 配置
            </CardTitle>
            <CardDescription>统一维护模型、API Key 与 Runtime 服务配置</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            配置项保存在浏览器 storage，知识摄入与对话页面会自动读取并应用。
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
