import { toPlainSpeechText } from "@/lib/markdown/speech";
import type { ReaderTab } from "@/lib/markdown/types";

export function isMarkdownFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  const hasMarkdownExtension =
    normalizedName.endsWith(".md") ||
    normalizedName.endsWith(".markdown") ||
    normalizedName.endsWith(".mdown") ||
    normalizedName.endsWith(".mkd");

  return (
    hasMarkdownExtension ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
}

export function createDocumentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createReaderTab(): ReaderTab {
  return {
    activeHeadingId: null,
    error: null,
    file: null,
    id: createDocumentId(),
    view: "preview",
  };
}

export function getReaderTabLabel(tab: ReaderTab, index: number) {
  return tab.file?.name ?? `New tab${index > 0 ? ` ${index + 1}` : ""}`;
}

export function isEditablePasteTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function getPastedDocumentName(content: string) {
  const heading = content.match(/^#{1,6}\s+(.+?)\s*#*\s*$/m)?.[1];
  const baseName = heading
    ? toPlainSpeechText(heading)
        .replace(/[/:*?"<>|]/g, "")
        .trim()
    : "Pasted markdown";

  return `${baseName.slice(0, 48) || "Pasted markdown"}.md`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}
