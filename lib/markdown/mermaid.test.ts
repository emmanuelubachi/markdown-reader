import { describe, expect, it } from "vitest";

import {
  getMermaidConfig,
  hasMermaidExtension,
  isMermaidCodeLanguage,
  toMermaidMarkdown,
} from "@/lib/markdown/mermaid";
import { parseMarkdown } from "@/lib/markdown/parse";

describe("hasMermaidExtension", () => {
  it("matches .mmd and .mermaid in any case", () => {
    expect(hasMermaidExtension("flow.mmd")).toBe(true);
    expect(hasMermaidExtension("Flow.MERMAID")).toBe(true);
    expect(hasMermaidExtension("flow.md")).toBe(false);
    expect(hasMermaidExtension("mmd")).toBe(false);
  });
});

describe("isMermaidCodeLanguage", () => {
  it("matches the mermaid fence language only", () => {
    expect(isMermaidCodeLanguage("mermaid")).toBe(true);
    expect(isMermaidCodeLanguage("Mermaid")).toBe(true);
    expect(isMermaidCodeLanguage("mermaidjs")).toBe(false);
    expect(isMermaidCodeLanguage(null)).toBe(false);
    expect(isMermaidCodeLanguage(undefined)).toBe(false);
  });
});

describe("toMermaidMarkdown", () => {
  it("wraps a diagram in one mermaid code block", () => {
    expect(toMermaidMarkdown("graph TD\n  A --> B\n\n")).toBe(
      "```mermaid\ngraph TD\n  A --> B\n```\n",
    );
  });

  it("parses back to a single code block with the diagram intact", () => {
    const diagram = "flowchart LR\n  A[`Start`] --> B[```end```]";
    const blocks = parseMarkdown(toMermaidMarkdown(diagram));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      code: diagram,
      language: "mermaid",
      type: "code",
    });
  });

  it("uses a fence longer than any backtick run in the diagram", () => {
    expect(toMermaidMarkdown("A[```x```]").startsWith("````mermaid\n")).toBe(
      true,
    );
  });
});

describe("getMermaidConfig", () => {
  it("renders strictly, without Mermaid's own error graphic", () => {
    const config = getMermaidConfig("light", "Inter");

    expect(config).toMatchObject({
      fontFamily: "Inter",
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: "base",
    });
  });

  it("switches the palette with the reader theme", () => {
    const light = getMermaidConfig("light", "Inter").themeVariables;
    const dark = getMermaidConfig("dark", "Inter").themeVariables;

    expect(light.darkMode).toBe(false);
    expect(dark.darkMode).toBe(true);
    expect(light.primaryColor).not.toBe(dark.primaryColor);
    expect(light.textColor).not.toBe(dark.textColor);
  });
});
