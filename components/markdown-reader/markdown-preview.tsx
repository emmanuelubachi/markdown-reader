"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { sanitizeHref, sanitizeImageSrc } from "@/lib/markdown/sanitize";
import type { MarkdownBlock } from "@/lib/markdown/types";

export function MarkdownPreview({
  blocks,
  onActiveHeadingChange,
}: {
  blocks: MarkdownBlock[];
  onActiveHeadingChange: (headingId: string) => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const headingSignature = useMemo(
    () =>
      blocks
        .filter((block) => block.type === "heading")
        .map((heading) => heading.id)
        .join("\n"),
    [blocks],
  );

  useEffect(() => {
    const article = articleRef.current;

    if (!article || typeof IntersectionObserver === "undefined") {
      return;
    }

    const headingElements = Array.from(
      article.querySelectorAll<HTMLElement>("[data-markdown-heading]"),
    );

    if (headingElements.length === 0) {
      return;
    }

    const scrollRoot = article.closest("[data-slot='scroll-area-viewport']");
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeading = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];

        if (visibleHeading?.target.id) {
          onActiveHeadingChange(visibleHeading.target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-12% 0px -72% 0px",
        threshold: [0, 1],
      },
    );

    headingElements.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [headingSignature, onActiveHeadingChange]);

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This markdown file is empty.
      </div>
    );
  }

  return (
    <article
      className="markdown-preview"
      data-readable-root="preview"
      ref={articleRef}
    >
      {blocks.map((block, index) => renderBlock(block, index))}
    </article>
  );
}

function renderBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case "heading": {
      const children = renderInline(block.text, `${index}-heading`);
      const key = `${block.id}-${index}`;

      if (block.level === 1) {
        return (
          <h1 data-markdown-heading id={block.id} key={key}>
            {children}
          </h1>
        );
      }

      if (block.level === 2) {
        return (
          <h2 data-markdown-heading id={block.id} key={key}>
            {children}
          </h2>
        );
      }

      if (block.level === 3) {
        return (
          <h3 data-markdown-heading id={block.id} key={key}>
            {children}
          </h3>
        );
      }

      if (block.level === 4) {
        return (
          <h4 data-markdown-heading id={block.id} key={key}>
            {children}
          </h4>
        );
      }

      if (block.level === 5) {
        return (
          <h5 data-markdown-heading id={block.id} key={key}>
            {children}
          </h5>
        );
      }

      return (
        <h6 data-markdown-heading id={block.id} key={key}>
          {children}
        </h6>
      );
    }
    case "paragraph":
      return (
        <p key={`paragraph-${index}`}>{renderInline(block.text, `${index}`)}</p>
      );
    case "blockquote":
      return (
        <blockquote key={`quote-${index}`}>
          <p>{renderInline(block.text, `${index}-quote`)}</p>
        </blockquote>
      );
    case "code":
      return (
        <figure key={`code-${index}`}>
          {block.language ? <figcaption>{block.language}</figcaption> : null}
          <pre>
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case "hr":
      return <hr key={`rule-${index}`} />;
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";

      return (
        <ListTag key={`list-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>
              {renderInline(item, `${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ListTag>
      );
    }
    case "table":
      return (
        <div className="table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th key={`${index}-head-${headerIndex}`}>
                    {renderInline(header, `${index}-head-${headerIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${index}-row-${rowIndex}`}>
                  {block.headers.map((_, cellIndex) => (
                    <td key={`${index}-cell-${rowIndex}-${cellIndex}`}>
                      {renderInline(
                        row[cellIndex] ?? "",
                        `${index}-cell-${rowIndex}-${cellIndex}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(!?\[[^\]]+\]\([^)\s]+(?:\s+"[^"]*")?\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(renderInlineToken(token, `${keyPrefix}-${match.index}`));
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderInlineToken(token: string, key: string): ReactNode {
  const image = token.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);

  if (image) {
    const alt = image[1];
    const src = sanitizeImageSrc(image[2]);

    if (!src) {
      return (
        <span className="image-fallback" key={key}>
          {alt || image[2]}
        </span>
      );
    }

    // Markdown image dimensions are user-authored, so Next Image cannot know them here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} key={key} src={src} />;
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);

  if (link) {
    const href = sanitizeHref(link[2]);

    if (!href) {
      return <span key={key}>{renderInline(link[1], `${key}-label`)}</span>;
    }

    return (
      <a href={href} key={key} rel="noreferrer" target="_blank">
        {renderInline(link[1], `${key}-label`)}
      </a>
    );
  }

  if (token.startsWith("`") && token.endsWith("`")) {
    return <code key={key}>{token.slice(1, -1)}</code>;
  }

  if (
    (token.startsWith("**") && token.endsWith("**")) ||
    (token.startsWith("__") && token.endsWith("__"))
  ) {
    return (
      <strong key={key}>
        {renderInline(token.slice(2, -2), `${key}-strong`)}
      </strong>
    );
  }

  if (
    (token.startsWith("*") && token.endsWith("*")) ||
    (token.startsWith("_") && token.endsWith("_"))
  ) {
    return <em key={key}>{renderInline(token.slice(1, -1), `${key}-em`)}</em>;
  }

  return token;
}
