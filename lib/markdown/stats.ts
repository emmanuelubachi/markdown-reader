import type { DocumentStats } from "@/lib/markdown/types";

export function getDocumentStats(content: string): DocumentStats {
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[>#*_`~|[\]()!-]/g, " ");
  const words = plainText.match(/\b[\w'-]+\b/g)?.length ?? 0;

  return {
    lines: content ? content.replace(/\r\n?/g, "\n").split("\n").length : 0,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    words,
  };
}
