import type { MarkdownBlock } from "@/lib/markdown/types";

const REMEMBERED_SELECTION_MAX_AGE_MS = 10_000;

let rememberedReadableSelection: { text: string; timestamp: number } | null =
  null;

export function getReadableChunks(blocks: MarkdownBlock[]) {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return splitSpeechText(block.text);
      case "blockquote":
        return splitSpeechText(`Quote. ${block.text}`);
      case "list":
        return block.items.flatMap((item, index) =>
          splitSpeechText(`Item ${index + 1}. ${item}`),
        );
      case "table": {
        const headers = block.headers.map(toPlainSpeechText);
        const rows =
          block.rows.length > 0
            ? block.rows
            : block.headers.length > 0
              ? [block.headers]
              : [];

        return rows.flatMap((row) => {
          const rowText = row
            .map((cell, index) => {
              const text = toPlainSpeechText(cell);
              const header = headers[index];

              if (!text) {
                return "";
              }

              return header && header !== text ? `${header}: ${text}` : text;
            })
            .filter(Boolean)
            .join(". ");

          return splitSpeechText(rowText);
        });
      }
      case "code":
      case "hr":
        return [];
    }
  });
}

function splitSpeechText(text: string) {
  const plainText = toPlainSpeechText(text);

  if (!plainText) {
    return [];
  }

  const sentences = plainText.match(/[^.!?]+[.!?]*/g) ?? [plainText];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (!trimmedSentence) {
      continue;
    }

    const nextChunk = currentChunk
      ? `${currentChunk} ${trimmedSentence}`
      : trimmedSentence;

    if (nextChunk.length > 220 && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = trimmedSentence;
    } else {
      currentChunk = nextChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function toPlainSpeechText(text: string) {
  return text
    .replace(/\r\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSelectedChunkIndex(chunks: string[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();
  const selectedSourceText = getRememberedReadableSelection();

  if (
    (!selection ||
      selection.isCollapsed ||
      !selectionWithinReadableRoot(selection)) &&
    !selectedSourceText
  ) {
    return null;
  }

  const selectedText = normalizeSpeechMatch(
    selection &&
      !selection.isCollapsed &&
      selectionWithinReadableRoot(selection)
      ? selection.toString()
      : selectedSourceText,
  );

  if (!selectedText) {
    return null;
  }

  const selectedWords = selectedText.split(" ").filter(Boolean);
  const chunkMatches = chunks.map((chunk, index) => ({
    index,
    text: normalizeSpeechMatch(chunk),
  }));

  const exactMatch = chunkMatches.find(
    (chunk) =>
      chunk.text.includes(selectedText) || selectedText.includes(chunk.text),
  );

  if (exactMatch) {
    return exactMatch.index;
  }

  const selectedPrefix = selectedWords.slice(0, 8).join(" ");
  const prefixMatch = chunkMatches.find(
    (chunk) => selectedPrefix.length > 8 && chunk.text.includes(selectedPrefix),
  );

  if (prefixMatch) {
    return prefixMatch.index;
  }

  const bestMatch = chunkMatches
    .map((chunk) => ({
      index: chunk.index,
      score: getWordOverlapScore(selectedWords, chunk.text),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch && bestMatch.score >= 2 ? bestMatch.index : null;
}

export function rememberReadableSelection(text: string) {
  const trimmedText = text.trim();

  rememberedReadableSelection = trimmedText
    ? { text: trimmedText, timestamp: Date.now() }
    : null;
}

function selectionWithinReadableRoot(selection: Selection) {
  return (
    nodeWithinReadableRoot(selection.anchorNode) ||
    nodeWithinReadableRoot(selection.focusNode)
  );
}

function nodeWithinReadableRoot(node: Node | null) {
  if (!node) {
    return false;
  }

  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return Boolean(element?.closest("[data-readable-root]"));
}

function normalizeSpeechMatch(text: string) {
  return toPlainSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRememberedReadableSelection() {
  if (
    !rememberedReadableSelection ||
    Date.now() - rememberedReadableSelection.timestamp >
      REMEMBERED_SELECTION_MAX_AGE_MS
  ) {
    rememberedReadableSelection = null;

    return "";
  }

  return rememberedReadableSelection.text;
}

function getWordOverlapScore(selectedWords: string[], chunkText: string) {
  const chunkWords = new Set(chunkText.split(" ").filter(Boolean));

  return selectedWords.reduce(
    (score, word) => (chunkWords.has(word) ? score + 1 : score),
    0,
  );
}
