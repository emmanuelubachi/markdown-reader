import {
  createMarkdownSlugger,
  getMarkdownNodeText,
  type MarkdownAstNode,
} from "@/lib/markdown/ast";

export function remarkHeadingIds() {
  return (tree: MarkdownAstNode) => {
    const slugHeading = createMarkdownSlugger();

    visitMarkdownAst(tree, (node) => {
      if (node.type !== "heading") {
        return;
      }

      const text = getMarkdownNodeText(node);

      if (!text) {
        return;
      }

      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          dataMarkdownHeading: true,
          id: slugHeading(text),
        },
      };
    });
  };
}

function visitMarkdownAst(
  node: MarkdownAstNode,
  visitor: (node: MarkdownAstNode) => void,
) {
  visitor(node);
  node.children?.forEach((child) => visitMarkdownAst(child, visitor));
}
