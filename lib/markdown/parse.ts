import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import {
  MARKDOWN_HEADING_ID_PREFIX,
  createMarkdownSlugger,
  getMarkdownNodeText,
  getMarkdownNodesText,
  type MarkdownAstNode,
} from "@/lib/markdown/ast";
import type { MarkdownBlock } from "@/lib/markdown/types";

type MarkdownRoot = {
  children?: MarkdownAstNode[];
  type: "root";
};

type MarkdownSlugger = ReturnType<typeof createMarkdownSlugger>;

const markdownParser = unified().use(remarkParse).use(remarkGfm);

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const tree = markdownParser.parse(markdown) as MarkdownRoot;
  const slugHeading = createMarkdownSlugger();

  return (tree.children ?? []).flatMap((node) =>
    getMarkdownBlocks(node, slugHeading),
  );
}

function getMarkdownBlocks(
  node: MarkdownAstNode,
  slugHeading: MarkdownSlugger,
): MarkdownBlock[] {
  const sourceLine = getNodeLine(node);

  switch (node.type) {
    case "heading": {
      const text = getMarkdownNodeText(node);

      if (!text) {
        return [];
      }

      return [
        {
          id: `${MARKDOWN_HEADING_ID_PREFIX}${slugHeading(text)}`,
          level: clampHeadingLevel(node.depth),
          sourceLine,
          text,
          type: "heading",
        },
      ];
    }
    case "paragraph": {
      const text = getMarkdownNodeText(node);

      return text ? [{ sourceLine, text, type: "paragraph" }] : [];
    }
    case "blockquote": {
      const text = getMarkdownNodesText(node.children);

      return text ? [{ sourceLine, text, type: "blockquote" }] : [];
    }
    case "code":
      return [
        {
          code: node.value ?? "",
          language: node.lang ?? "",
          sourceLine,
          type: "code",
        },
      ];
    case "thematicBreak":
      return [{ sourceLine, type: "hr" }];
    case "list":
      return getListBlock(node);
    case "table":
      return getTableBlock(node);
    case "html": {
      const text = getMarkdownNodeText(node);

      return text ? [{ sourceLine, text, type: "paragraph" }] : [];
    }
    case "footnoteDefinition": {
      const text = getMarkdownNodesText(node.children);

      if (!text) {
        return [];
      }

      return [
        {
          sourceLine,
          text: `Footnote ${node.identifier ?? ""}. ${text}`.trim(),
          type: "paragraph",
        },
      ];
    }
    default:
      return (node.children ?? []).flatMap((child) =>
        getMarkdownBlocks(child, slugHeading),
      );
  }
}

function getListBlock(node: MarkdownAstNode): MarkdownBlock[] {
  // Keep each item's text and source line together, then drop empties, so
  // `items` and `itemLines` stay index-aligned.
  const entries = (node.children ?? [])
    .filter((child) => child.type === "listItem")
    .map((item) => ({ line: getNodeLine(item), text: getListItemText(item) }))
    .filter((entry) => entry.text);

  if (entries.length === 0) {
    return [];
  }

  return [
    {
      itemLines: entries.map((entry) => entry.line),
      items: entries.map((entry) => entry.text),
      ordered: Boolean(node.ordered),
      sourceLine: getNodeLine(node),
      type: "list",
    },
  ];
}

function getListItemText(item: MarkdownAstNode) {
  const text = getMarkdownNodeText(item);

  if (!text) {
    return "";
  }

  if (item.checked === true) {
    return `Completed task. ${text}`;
  }

  if (item.checked === false) {
    return `Open task. ${text}`;
  }

  return text;
}

function getTableBlock(node: MarkdownAstNode): MarkdownBlock[] {
  const rows = (node.children ?? [])
    .filter((child) => child.type === "tableRow")
    .map((row) => ({
      cells: (row.children ?? [])
        .filter((cell) => cell.type === "tableCell")
        .map((cell) => getMarkdownNodeText(cell)),
      line: getNodeLine(row),
    }))
    .filter((row) => row.cells.length > 0);
  const [headerRow, ...bodyRows] = rows;

  if (!headerRow || headerRow.cells.length === 0) {
    return [];
  }

  return [
    {
      headerLine: headerRow.line,
      headers: headerRow.cells,
      rowLines: bodyRows.map((row) => row.line),
      rows: bodyRows.map((row) => row.cells),
      sourceLine: getNodeLine(node),
      type: "table",
    },
  ];
}

function getNodeLine(node: MarkdownAstNode): number {
  return node.position?.start?.line ?? 0;
}

function clampHeadingLevel(depth: number | undefined) {
  if (!depth || depth < 1) {
    return 1;
  }

  if (depth > 6) {
    return 6;
  }

  return depth;
}
