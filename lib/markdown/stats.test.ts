import { describe, expect, it } from "vitest";

import { getDocumentStats } from "@/lib/markdown/stats";

describe("getDocumentStats", () => {
  it("returns zeroed stats with a minimum reading time for empty content", () => {
    expect(getDocumentStats("")).toEqual({
      lines: 0,
      readingMinutes: 1,
      words: 0,
    });
  });

  it("counts words and lines of plain text", () => {
    expect(getDocumentStats("hello brave new world\nsecond line")).toEqual({
      lines: 2,
      readingMinutes: 1,
      words: 6,
    });
  });

  it("normalizes CRLF and CR line endings before counting lines", () => {
    expect(getDocumentStats("one\r\ntwo\rthree").lines).toBe(3);
  });

  it("ignores markdown punctuation when counting words", () => {
    const stats = getDocumentStats("# Title\n\n> **bold** _text_ [link](url)");

    expect(stats.words).toBe(5);
  });

  it("excludes fenced code blocks from the word count but not the line count", () => {
    const stats = getDocumentStats(
      "intro\n\n```js\nconst ignored = words + here;\n```\n\noutro",
    );

    expect(stats.words).toBe(2);
    expect(stats.lines).toBe(7);
  });

  it("rounds reading time up at 220 words per minute", () => {
    const words = (count: number) => Array(count).fill("word").join(" ");

    expect(getDocumentStats(words(220)).readingMinutes).toBe(1);
    expect(getDocumentStats(words(221)).readingMinutes).toBe(2);
  });
});
