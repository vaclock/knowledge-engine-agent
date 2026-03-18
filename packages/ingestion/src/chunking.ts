import type { ChunkingOptions } from "./types.js";

export const splitTextIntoChunks = (text: string, options: ChunkingOptions = {}): string[] => {
  const chunkSize = options.chunkSize ?? 500;
  const overlap = options.overlap ?? 80;
  if (!text.trim()) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + chunkSize, text.length);
    if (end < text.length) {
      const breakpoint = Math.max(text.lastIndexOf("。", end), text.lastIndexOf("\n", end));
      if (breakpoint > cursor + chunkSize / 2) {
        end = breakpoint + 1;
      }
    }
    const chunk = text.slice(cursor, end).trim();
    if (chunk.length > 5) chunks.push(chunk);
    if (end === text.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
};
