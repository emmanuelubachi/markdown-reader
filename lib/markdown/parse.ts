import type { MarkdownBlock } from "@/lib/markdown/types";

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  const slugCounts = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^(```|~~~)\s*([\w-]+)?\s*$/);

    if (fence) {
      const fenceMarker = fence[1];
      const codeLines: string[] = [];
      index += 1;

      while (
        index < lines.length &&
        !lines[index]?.trimEnd().startsWith(fenceMarker)
      ) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language: fence[2] ?? "",
        type: "code",
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (heading) {
      const text = heading[2].trim();

      blocks.push({
        id: uniqueSlug(text, slugCounts),
        level: heading[1].length,
        text,
        type: "heading",
      });
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const parsedTable = parseTable(lines, index);
      blocks.push(parsedTable.block);
      index = parsedTable.nextIndex;
      continue;
    }

    const listMatch = getListMatch(line);

    if (listMatch) {
      const ordered = listMatch.ordered;
      const items: string[] = [];

      while (index < lines.length) {
        const nextListMatch = getListMatch(lines[index] ?? "");

        if (!nextListMatch || nextListMatch.ordered !== ordered) {
          break;
        }

        items.push(nextListMatch.text);
        index += 1;
      }

      blocks.push({ items, ordered, type: "list" });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }

      blocks.push({
        text: quoteLines.join(" ").trim(),
        type: "blockquote",
      });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !isBlockStart(lines, index)
    ) {
      paragraphLines.push(lines[index]?.trim() ?? "");
      index += 1;
    }

    blocks.push({
      text: paragraphLines.join(" "),
      type: "paragraph",
    });
  }

  return blocks;
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index]?.trimEnd() ?? "";

  return (
    /^(```|~~~)/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim()) ||
    Boolean(getListMatch(line)) ||
    /^\s*>\s?/.test(line) ||
    isTableStart(lines, index)
  );
}

function getListMatch(line: string) {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);

  if (unordered) {
    return {
      ordered: false,
      text: unordered[1].trim(),
    };
  }

  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

  if (ordered) {
    return {
      ordered: true,
      text: ordered[1].trim(),
    };
  }

  return null;
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index]?.trim() ?? "";
  const divider = lines[index + 1]?.trim() ?? "";
  const headerCells = splitTableRow(header);

  return (
    header.includes("|") &&
    headerCells.length > 1 &&
    isDividerRow(divider) &&
    splitTableRow(divider).length === headerCells.length
  );
}

function parseTable(lines: string[], startIndex: number) {
  const headers = splitTableRow(lines[startIndex] ?? "");
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";

    if (!line || !line.includes("|") || isDividerRow(line)) {
      break;
    }

    rows.push(splitTableRow(line));
    index += 1;
  }

  return {
    block: {
      headers,
      rows,
      type: "table" as const,
    },
    nextIndex: index,
  };
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isDividerRow(row: string) {
  const cells = splitTableRow(row);

  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function uniqueSlug(text: string, counts: Map<string, number>) {
  const baseSlug =
    text
      .toLowerCase()
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const count = counts.get(baseSlug) ?? 0;

  counts.set(baseSlug, count + 1);

  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
}
