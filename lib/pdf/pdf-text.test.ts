import { describe, expect, it } from "vitest";

import {
  escapeMarkdownText,
  pdfTextRunsToMarkdown,
  type PdfTextRun,
} from "@/lib/pdf/pdf-text";

function run(
  text: string,
  x: number,
  y: number,
  options: Partial<PdfTextRun> = {},
): PdfTextRun {
  return {
    fontFamily: "serif",
    fontName: "body",
    hasEOL: false,
    height: 10,
    text,
    width: text.length * 5,
    x,
    y,
    ...options,
  };
}

describe("pdfTextRunsToMarkdown", () => {
  it("reconstructs words and lines from positioned PDF text runs", () => {
    expect(
      pdfTextRunsToMarkdown([
        run("Hello", 0, 100),
        run("world", 30, 100, { hasEOL: true }),
        run("Second line", 0, 85),
      ]),
    ).toBe("Hello world Second line");
  });

  it("does not add spaces before punctuation", () => {
    expect(
      pdfTextRunsToMarkdown([
        run("Hello", 0, 100),
        run(",", 30, 100),
        run("reader", 40, 100),
      ]),
    ).toBe("Hello, reader");
  });

  it("escapes extracted text that would otherwise become Markdown or HTML", () => {
    expect(
      pdfTextRunsToMarkdown([run("# Heading <script>", 0, 100)]),
    ).toBe("\\# Heading \\<script\\>");
  });

  it("sorts content by page position and restores headings and paragraphs", () => {
    const extractedOutOfOrder = [
      run("This memo covers what the tracker needs from your team.", 72, 660),
      run("It asks for one check and one confirmation.", 72, 647),
      run("Twelve actions carry outcome badges, each taken from a", 72, 585),
      run("judgment already published in your paper.", 72, 572),
      run("Second paragraph starts here.", 72, 545),
      run("The tracker shows the press images.", 72, 485),
      run("C H I N A  G L O B A L", 72, 760, {
        fontFamily: "sans-serif",
        fontName: "label",
        height: 8,
      }),
      run("V1 review memo", 72, 730, {
        fontFamily: "sans-serif",
        fontName: "heading",
        height: 22,
      }),
      run("24 August 2026", 72, 705, {
        fontFamily: "sans-serif",
        fontName: "label",
        height: 9,
      }),
      run("1", 40, 610, {
        fontFamily: "sans-serif",
        fontName: "heading",
        height: 12,
      }),
      run("One check: the outcome badges", 72, 610, {
        fontFamily: "sans-serif",
        fontName: "heading",
        height: 12,
      }),
      run("2", 40, 510, {
        fontFamily: "sans-serif",
        fontName: "heading",
        height: 12,
      }),
      run("One confirmation: the press images", 72, 510, {
        fontFamily: "sans-serif",
        fontName: "heading",
        height: 12,
      }),
    ];

    expect(pdfTextRunsToMarkdown(extractedOutOfOrder)).toBe(
      [
        "CHINA GLOBAL",
        "### V1 review memo",
        "24 August 2026",
        "This memo covers what the tracker needs from your team. It asks for one check and one confirmation.",
        "### 1. One check: the outcome badges",
        "Twelve actions carry outcome badges, each taken from a judgment already published in your paper.",
        "Second paragraph starts here.",
        "### 2. One confirmation: the press images",
        "The tracker shows the press images.",
      ].join("\n\n"),
    );
  });

  it("keeps a larger serif standfirst as one paragraph", () => {
    expect(
      pdfTextRunsToMarkdown([
        run(
          "This memo covers what the tracker needs from your team at V1. It asks for",
          90,
          670,
          { fontName: "standfirst", height: 12 },
        ),
        run(
          "one check and one confirmation before public launch, and notes one",
          90,
          652,
          { fontName: "standfirst", height: 12 },
        ),
        run("dataset decision for your awareness.", 90, 634, {
          fontName: "standfirst",
          height: 12,
        }),
        run("1. One check: the outcome badges", 90, 600, {
          fontFamily: "sans-serif",
          fontName: "heading",
          height: 12.5,
        }),
        run(
          "Twelve actions in the tracker carry outcome badges, each taken from a judgment",
          90,
          576,
          { height: 10.5 },
        ),
        run(
          "already published in the supporting paper. Where the text passes no verdict, no badge appears.",
          90,
          560,
          { height: 10.5 },
        ),
      ]),
    ).toBe(
      [
        "This memo covers what the tracker needs from your team at V1. It asks for one check and one confirmation before public launch, and notes one dataset decision for your awareness.",
        "### 1. One check: the outcome badges",
        "Twelve actions in the tracker carry outcome badges, each taken from a judgment already published in the supporting paper. Where the text passes no verdict, no badge appears.",
      ].join("\n\n"),
    );
  });

  it("removes tracking between letters while preserving word gaps", () => {
    expect(
      pdfTextRunsToMarkdown([
        run("C", 0, 100, { fontName: "label", height: 8, width: 5 }),
        run("H", 6, 100, { fontName: "label", height: 8, width: 5 }),
        run("I", 12, 100, { fontName: "label", height: 8, width: 5 }),
        run("N", 18, 100, { fontName: "label", height: 8, width: 5 }),
        run("A", 24, 100, { fontName: "label", height: 8, width: 5 }),
        run("G", 35, 100, { fontName: "label", height: 8, width: 5 }),
        run("L", 41, 100, { fontName: "label", height: 8, width: 5 }),
        run("O", 47, 100, { fontName: "label", height: 8, width: 5 }),
        run("B", 53, 100, { fontName: "label", height: 8, width: 5 }),
        run("A", 59, 100, { fontName: "label", height: 8, width: 5 }),
        run("L", 65, 100, { fontName: "label", height: 8, width: 5 }),
      ]),
    ).toBe("CHINA GLOBAL");
  });

  it("uses positioned spacer runs to distinguish real gaps in tracked labels", () => {
    expect(
      pdfTextRunsToMarkdown([
        run("CHI NA", 100, 100, {
          fontName: "label",
          height: 8,
          width: 25.8,
        }),
        run(" ", 125.8, 100, {
          fontName: "label",
          height: 0,
          width: 8.2,
        }),
        run("GLOBAL", 134, 100, {
          fontName: "label",
          height: 8,
          width: 29.9,
        }),
        run(" ", 163.9, 100, {
          fontName: "label",
          height: 0,
          width: 9.1,
        }),
        run("M", 173, 100, {
          fontName: "label",
          height: 8,
          width: 6.7,
        }),
        run("EDI ATI ON", 178, 100, {
          fontName: "label",
          height: 8,
          width: 40.8,
        }),
      ]),
    ).toBe("CHINA GLOBAL MEDIATION");
  });
});

describe("escapeMarkdownText", () => {
  it("escapes inline formatting characters", () => {
    expect(escapeMarkdownText("Use *stars* and [links]")).toBe(
      "Use \\*stars\\* and \\[links\\]",
    );
  });
});
