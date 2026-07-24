"use client";

import { useMemo } from "react";

import type { ReadAloudController } from "@/hooks/use-read-aloud";
import { parseMarkdown } from "@/lib/markdown/parse";
import {
  getReadableSpeech,
  type SpeechSection,
} from "@/lib/markdown/speech";
import { getDocumentStats } from "@/lib/markdown/stats";
import type {
  DocumentStats,
  HeadingBlock,
  MarkdownBlock,
  ReaderTab,
} from "@/lib/markdown/types";

export type ReaderTabModel = {
  blocks: MarkdownBlock[];
  headings: HeadingBlock[];
  outlineActiveHeadingId: null | string;
  readAloudChunks: string[];
  readAloudChunkLines: number[];
  readAloudSections: SpeechSection[];
  stats: DocumentStats;
};

export function useReaderTabModel(tab: ReaderTab | null): ReaderTabModel {
  const content = tab?.file?.content ?? "";
  const activeHeadingId = tab?.activeHeadingId ?? null;
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  const stats = useMemo(() => getDocumentStats(content), [content]);
  const headings = useMemo(
    () => blocks.filter((block) => block.type === "heading"),
    [blocks],
  );
  const {
    chunkLines: readAloudChunkLines,
    chunks: readAloudChunks,
    sections: readAloudSections,
  } = useMemo(() => getReadableSpeech(blocks), [blocks]);
  const outlineActiveHeadingId = useMemo(() => {
    if (
      activeHeadingId &&
      headings.some((heading) => heading.id === activeHeadingId)
    ) {
      return activeHeadingId;
    }

    return headings[0]?.id ?? null;
  }, [activeHeadingId, headings]);

  return {
    blocks,
    headings,
    outlineActiveHeadingId,
    readAloudChunks,
    readAloudChunkLines,
    readAloudSections,
    stats,
  };
}

export function getSpeakingLine(
  reader: ReadAloudController,
  tabId: string,
  chunkLines: number[],
): number | null {
  if (reader.sourceTabId !== tabId) {
    return null;
  }

  if (
    reader.status !== "playing" &&
    reader.status !== "paused" &&
    reader.status !== "loading"
  ) {
    return null;
  }

  return chunkLines[reader.currentIndex] ?? null;
}
