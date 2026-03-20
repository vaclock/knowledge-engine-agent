import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Knowledge Engine Agent",
  description: "System-level agent with ingestion + RAG runtime"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="font-semibold text-slate-900">
                Knowledge Engine Agent
              </Link>
              <nav className="flex items-center gap-2 text-sm">
                <Link href="/ingest" className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
                  上传知识库
                </Link>
                <Link href="/chat" className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
                  对话流
                </Link>
                <Link href="/config" className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
                  配置中心
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
