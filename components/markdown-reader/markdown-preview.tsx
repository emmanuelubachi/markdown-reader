"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import {
  markdownComponents,
  markdownSanitizeSchema,
  markdownUrlTransform,
} from "@/components/markdown-reader/markdown-preview-renderers";
import { remarkHeadingIds } from "@/lib/markdown/remark-heading-ids";

const USER_SCROLL_PAUSE_MS = 4000;

export function MarkdownPreview({
  activeSourceLine = null,
  content,
  onActiveHeadingChange,
}: {
  activeSourceLine?: number | null;
  content: string;
  onActiveHeadingChange: (headingId: string) => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const userScrolledAtRef = useRef(0);

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
  }, [content, onActiveHeadingChange]);

  // Pause auto-follow briefly after manual scrolling.
  useEffect(() => {
    const article = articleRef.current;
    const viewport = article?.closest("[data-slot='scroll-area-viewport']");

    if (!viewport) {
      return;
    }

    const markUserScroll = () => {
      userScrolledAtRef.current = Date.now();
    };

    viewport.addEventListener("wheel", markUserScroll, { passive: true });
    viewport.addEventListener("touchmove", markUserScroll, { passive: true });
    viewport.addEventListener("keydown", markUserScroll);

    return () => {
      viewport.removeEventListener("wheel", markUserScroll);
      viewport.removeEventListener("touchmove", markUserScroll);
      viewport.removeEventListener("keydown", markUserScroll);
    };
  }, [content]);

  useEffect(() => {
    const article = articleRef.current;

    if (!article) {
      return;
    }

    article.querySelector("[data-speaking]")?.removeAttribute("data-speaking");

    if (activeSourceLine == null) {
      return;
    }

    const target = article.querySelector<HTMLElement>(
      `[data-source-line="${activeSourceLine}"]`,
    );

    if (!target) {
      return;
    }

    target.setAttribute("data-speaking", "true");

    if (Date.now() - userScrolledAtRef.current > USER_SCROLL_PAUSE_MS) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [activeSourceLine, content]);

  if (!content.trim()) {
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
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
        remarkPlugins={[remarkGfm, remarkHeadingIds]}
        urlTransform={markdownUrlTransform}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
