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
          text,
          type: "heading",
        },
      ];
    }
    case "paragraph": {
      const text = getMarkdownNodeText(node);

      return text ? [{ text, type: "paragraph" }] : [];
    }
    case "blockquote": {
      const text = getMarkdownNodesText(node.children);

      return text ? [{ text, type: "blockquote" }] : [];
    }
    case "code":
      return [
        {
          code: node.value ?? "",
          language: node.lang ?? "",
          type: "code",
        },
      ];
    case "thematicBreak":
      return [{ type: "hr" }];
    case "list":
      return getListBlock(node);
    case "table":
      return getTableBlock(node);
    case "html": {
      const text = getMarkdownNodeText(node);

      return text ? [{ text, type: "paragraph" }] : [];
    }
    case "footnoteDefinition": {
      const text = getMarkdownNodesText(node.children);

      if (!text) {
        return [];
      }

      return [
        {
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
  const items = (node.children ?? [])
    .filter((child) => child.type === "listItem")
    .map(getListItemText)
    .filter(Boolean);

  if (items.length === 0) {
    return [];
  }

  return [
    {
      items,
      ordered: Boolean(node.ordered),
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
    .map((row) =>
      (row.children ?? [])
        .filter((cell) => cell.type === "tableCell")
        .map((cell) => getMarkdownNodeText(cell)),
    )
    .filter((row) => row.length > 0);
  const [headers, ...bodyRows] = rows;

  if (!headers || headers.length === 0) {
    return [];
  }

  return [
    {
      headers,
      rows: bodyRows,
      type: "table",
    },
  ];
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
