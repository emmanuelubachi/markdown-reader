"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { CodeXml, TriangleAlert, Workflow } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  getDiagramMinWidth,
  getMermaidConfig,
  type MermaidTheme,
} from "@/lib/markdown/mermaid";

type Mermaid = (typeof import("mermaid"))["default"];

type DiagramRender =
  | { key: string; status: "error"; message: string }
  | { key: string; status: "ready"; svg: string };

// Mermaid is large, so it loads only when a document contains a diagram.
let mermaidPromise: Promise<Mermaid> | null = null;
let renderSequence = 0;

function loadMermaid() {
  mermaidPromise ??= import("mermaid").then((module) => module.default);

  return mermaidPromise;
}

function renderKeyOf(theme: MermaidTheme, code: string) {
  return `${theme}\n${code}`;
}

function describeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return message.trim() || "Mermaid could not parse this diagram.";
}

export function MermaidDiagram({ code }: { code: string }) {
  const { resolvedTheme } = useTheme();
  const theme: MermaidTheme | null = resolvedTheme
    ? resolvedTheme === "dark"
      ? "dark"
      : "light"
    : null;
  const idPrefix = `mermaid-${useId().replace(/[^\w-]/g, "")}`;
  const [lastRender, setLastRender] = useState<DiagramRender | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!theme) {
      return;
    }

    let cancelled = false;
    const key = renderKeyOf(theme, code);
    // Each render gets a fresh id: Mermaid scopes the SVG's styles to it, and a
    // superseded render may still be in Mermaid's queue.
    const renderId = `${idPrefix}-${(renderSequence += 1)}`;

    loadMermaid()
      .then((mermaid) => {
        mermaid.initialize(
          getMermaidConfig(theme, getComputedStyle(document.body).fontFamily),
        );

        return mermaid.render(renderId, code);
      })
      .then(({ svg }) => {
        if (!cancelled) {
          setLastRender({ key, status: "ready", svg });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLastRender({ key, message: describeError(error), status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, idPrefix, theme]);

  const isCurrent =
    theme !== null && lastRender?.key === renderKeyOf(theme, code);
  const error = isCurrent && lastRender?.status === "error" ? lastRender : null;
  // While a theme switch or edit re-renders, keep the previous diagram on
  // screen instead of collapsing to a placeholder.
  const svg = lastRender?.status === "ready" ? lastRender.svg : null;
  const minWidth = svg ? getDiagramMinWidth(svg) : null;
  const isCodeVisible = showCode || error !== null;

  return (
    <figure className="mermaid-figure">
      <figcaption className="mermaid-caption">
        <span>mermaid</span>
        {error ? null : (
          <Button
            aria-pressed={showCode}
            className="mermaid-toggle"
            onClick={() => setShowCode((current) => !current)}
            size="xs"
            type="button"
            variant="ghost"
          >
            {showCode ? (
              <Workflow aria-hidden="true" />
            ) : (
              <CodeXml aria-hidden="true" />
            )}
            {showCode ? "Diagram" : "Code"}
          </Button>
        )}
      </figcaption>

      {error ? (
        <div className="mermaid-error" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div>
            <p className="mermaid-error-title">
              This diagram could not be rendered
            </p>
            <p className="mermaid-error-message">{error.message}</p>
          </div>
        </div>
      ) : null}

      {isCodeVisible ? (
        <pre>
          <code className="language-mermaid">{code}</code>
        </pre>
      ) : svg ? (
        <div
          className="mermaid-diagram"
          // Mermaid renders with securityLevel "strict": label HTML is
          // sanitized and interactive callbacks are disabled.
          dangerouslySetInnerHTML={{ __html: svg }}
          style={
            minWidth
              ? ({ "--diagram-min-width": `${minWidth}px` } as CSSProperties)
              : undefined
          }
        />
      ) : (
        <div className="mermaid-diagram" data-state="pending">
          Rendering diagram…
        </div>
      )}
    </figure>
  );
}
