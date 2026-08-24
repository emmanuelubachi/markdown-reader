export type PdfTextRun = {
  fontFamily: string;
  fontName: string;
  hasEOL: boolean;
  height: number;
  text: string;
  width: number;
  x: number;
  y: number;
};

type PdfTextLine = {
  fontFamilies: Map<string, number>;
  height: number;
  text: string;
  x: number;
  y: number;
};

type PageTextMetrics = {
  bodyFontFamily: string;
  bodyHeight: number;
  lineGap: number;
};

export function pdfTextRunsToMarkdown(runs: PdfTextRun[]) {
  const lines = buildTextLines(runs);

  if (lines.length === 0) {
    return "";
  }

  const metrics = getPageTextMetrics(lines);
  const blocks: string[] = [];
  let paragraphLines: string[] = [];

  function commitParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push(escapeMarkdownText(joinWrappedLines(paragraphLines)));
    paragraphLines = [];
  }

  for (const [index, line] of lines.entries()) {
    const nextLine = lines[index + 1];

    if (isHeadingLine(line, metrics)) {
      commitParagraph();
      blocks.push(
        "### " + escapeInlineMarkdownText(formatHeadingText(line.text)),
      );
      continue;
    }

    paragraphLines.push(line.text);

    if (!nextLine || shouldBreakParagraph(line, nextLine, metrics)) {
      commitParagraph();
    }
  }

  commitParagraph();

  return blocks.join("\n\n");
}

export function escapeMarkdownText(value: string) {
  return escapeInlineMarkdownText(value).replace(
    /^(\s*)(#{1,6}|>|[-+] |\d+[.)] )/,
    "$1\\$2",
  );
}

function escapeInlineMarkdownText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([\x60*_\[\]<>])/g, "\\$1");
}

function buildTextLines(runs: PdfTextRun[]) {
  const normalizedRuns = runs
    .map((run) => ({
      ...run,
      height: Math.max(Math.abs(run.height), 1),
      text: run.text.replace(/\u0000/g, ""),
    }))
    // Keep positioned spacer runs. PDF.js uses these to represent real word
    // boundaries in letter-tracked labels, while it may inject false spaces
    // inside the neighboring text runs.
    .filter((run) => run.text.trim() || run.width > 0)
    .sort((first, second) => second.y - first.y || first.x - second.x);
  const groupedRuns: Array<{
    runs: PdfTextRun[];
    weightedY: number;
    weight: number;
  }> = [];

  for (const run of normalizedRuns) {
    const candidate = groupedRuns.find((line) => {
      const averageY = line.weightedY / line.weight;
      const lineHeight = Math.max(
        ...line.runs.map((lineRun) => lineRun.height),
        run.height,
      );

      return Math.abs(averageY - run.y) <= Math.max(1.5, lineHeight * 0.38);
    });

    if (candidate) {
      const weight = Math.max(run.text.trim().length, 1);

      candidate.runs.push(run);
      candidate.weightedY += run.y * weight;
      candidate.weight += weight;
    } else {
      const weight = Math.max(run.text.trim().length, 1);

      groupedRuns.push({
        runs: [run],
        weightedY: run.y * weight,
        weight,
      });
    }
  }

  return groupedRuns
    .map(({ runs: lineRuns, weightedY, weight }): PdfTextLine => {
      const sortedRuns = lineRuns.sort((first, second) => first.x - second.x);
      const fontFamilies = new Map<string, number>();

      for (const run of sortedRuns) {
        fontFamilies.set(
          run.fontFamily,
          (fontFamilies.get(run.fontFamily) ?? 0) + run.text.trim().length,
        );
      }

      return {
        fontFamilies,
        height: weightedMedian(
          sortedRuns.map((run) => ({
            value: run.height,
            weight: Math.max(run.text.trim().length, 1),
          })),
        ),
        text: composeLineText(sortedRuns),
        x: Math.min(...sortedRuns.map((run) => run.x)),
        y: weightedY / weight,
      };
    })
    .filter((line) => line.text)
    .sort((first, second) => second.y - first.y || first.x - second.x);
}

function composeLineText(runs: PdfTextRun[]) {
  let line = "";
  let previousRun: PdfTextRun | null = null;
  const hasPositionedSpacer = runs.some(
    (run) => !run.text.trim() && run.width > 0,
  );

  for (const run of runs) {
    const text = normalizeRunText(run.text, hasPositionedSpacer);

    if (!text) {
      continue;
    }

    if (previousRun && shouldInsertSpace(previousRun, run, line, text)) {
      line += " ";
    }

    line += text;
    previousRun = run;
  }

  return normalizeTrackedCapitals(line.replace(/\s+/g, " ").trim());
}

function getPageTextMetrics(lines: PdfTextLine[]): PageTextMetrics {
  const bodyHeight = weightedMode(
    lines.map((line) => ({
      value: line.height,
      weight: Math.max(line.text.length, 1),
    })),
  );
  const bodyFontCharacters = new Map<string, number>();

  for (const line of lines) {
    if (
      line.height < bodyHeight * 0.78 ||
      line.height > bodyHeight * 1.28
    ) {
      continue;
    }

    for (const [fontFamily, characterCount] of line.fontFamilies) {
      bodyFontCharacters.set(
        fontFamily,
        (bodyFontCharacters.get(fontFamily) ?? 0) + characterCount,
      );
    }
  }

  const candidateGaps = lines.flatMap((line, index) => {
    const nextLine = lines[index + 1];

    if (!nextLine) {
      return [];
    }

    const gap = line.y - nextLine.y;
    const bothBodySized =
      Math.abs(line.height - bodyHeight) <= bodyHeight * 0.3 &&
      Math.abs(nextLine.height - bodyHeight) <= bodyHeight * 0.3;

    return bothBodySized &&
      gap >= bodyHeight * 0.85 &&
      gap <= bodyHeight * 2
      ? [gap]
      : [];
  });

  return {
    bodyFontFamily: getLargestMapKey(bodyFontCharacters),
    bodyHeight,
    lineGap:
      candidateGaps.length > 0
        ? median(candidateGaps)
        : Math.max(bodyHeight * 1.25, 1),
  };
}

function isHeadingLine(line: PdfTextLine, metrics: PageTextMetrics) {
  const heightRatio = line.height / metrics.bodyHeight;
  const isShort = line.text.length <= 140;
  const nonBodyCharacters = [...line.fontFamilies.entries()].reduce(
    (total, [fontFamily, characters]) =>
      fontFamily === metrics.bodyFontFamily ? total : total + characters,
    0,
  );
  const usesDistinctFont =
    nonBodyCharacters / Math.max(line.text.length, 1) >= 0.55;

  return (
    isShort &&
    (heightRatio >= 1.42 ||
      (heightRatio >= 1.03 && usesDistinctFont && !looksLikeDate(line.text)))
  );
}

function shouldBreakParagraph(
  line: PdfTextLine,
  nextLine: PdfTextLine,
  metrics: PageTextMetrics,
) {
  if (isHeadingLine(nextLine, metrics)) {
    return true;
  }

  const gap = line.y - nextLine.y;
  const indentationChange = Math.abs(line.x - nextLine.x);
  const bodySized =
    line.height <= metrics.bodyHeight * 1.3 &&
    nextLine.height <= metrics.bodyHeight * 1.3;

  return (
    gap > metrics.lineGap * 1.24 ||
    (bodySized &&
      indentationChange > metrics.bodyHeight * 1.6 &&
      /[.!?:"”’)]$/.test(line.text))
  );
}

function joinWrappedLines(lines: string[]) {
  return lines.reduce((paragraph, line) => {
    if (!paragraph) {
      return line;
    }

    if (/-$/.test(paragraph) && /^[a-z]/.test(line)) {
      return paragraph.slice(0, -1) + line;
    }

    return paragraph + " " + line;
  }, "");
}

function formatHeadingText(text: string) {
  return text.replace(/^(\d{1,3})\s+(?=\S)/, "$1. ");
}

function normalizeRunText(text: string, collapseFragmentedCapitals: boolean) {
  const normalized = text.replace(/\u0000/g, "").trim();

  if (!normalized) {
    return "";
  }

  const trackedWords = normalized.split(/\s{2,}/);

  if (
    trackedWords.length > 1 &&
    trackedWords.every((word) => /^(?:[A-Z]\s+)+[A-Z]$/.test(word))
  ) {
    return trackedWords.map((word) => word.replace(/\s+/g, "")).join(" ");
  }

  if (/^(?:[A-Z]\s+){4,}[A-Z]$/.test(normalized)) {
    return normalized.replace(/\s+/g, "");
  }

  if (
    collapseFragmentedCapitals &&
    /^[A-Z]+(?:\s+[A-Z]+)+$/.test(normalized)
  ) {
    return normalized.replace(/\s+/g, "");
  }

  return normalized;
}

function normalizeTrackedCapitals(text: string) {
  const matches = text.match(/(?:\b[A-Z]\s+){4,}[A-Z]\b/g);

  if (!matches) {
    return text;
  }

  return matches.reduce(
    (normalized, match) => normalized.replace(match, match.replace(/\s+/g, "")),
    text,
  );
}

function shouldInsertSpace(
  previous: PdfTextRun,
  current: PdfTextRun,
  accumulated: string,
  currentText: string,
) {
  if (/\s$/.test(accumulated) || /^\s/.test(currentText)) {
    return false;
  }

  if (/^[,.;:!?%)\]}]/.test(currentText) || /[([{/]$/.test(accumulated)) {
    return false;
  }

  const previousText = previous.text.trim();
  const previousRight = previous.x + previous.width;
  const gap = current.x - previousRight;
  const em = Math.max(previous.height, current.height, 1);
  const trackedCapitals =
    /^[A-Z]$/.test(previousText) && /^[A-Z]$/.test(currentText);

  return gap > em * (trackedCapitals ? 0.38 : 0.12);
}

function looksLikeDate(text: string) {
  return (
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(text) ||
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  );
}

function getLargestMapKey(values: Map<string, number>) {
  let largestKey = "";
  let largestValue = -1;

  for (const [key, value] of values) {
    if (value > largestValue) {
      largestKey = key;
      largestValue = value;
    }
  }

  return largestKey;
}

function weightedMedian(values: Array<{ value: number; weight: number }>) {
  if (values.length === 0) {
    return 1;
  }

  const sorted = [...values].sort((first, second) => first.value - second.value);
  const midpoint =
    sorted.reduce((total, entry) => total + entry.weight, 0) / 2;
  let weight = 0;

  for (const entry of sorted) {
    weight += entry.weight;

    if (weight >= midpoint) {
      return entry.value;
    }
  }

  return sorted.at(-1)?.value ?? 1;
}

function weightedMode(values: Array<{ value: number; weight: number }>) {
  if (values.length === 0) {
    return 1;
  }

  const buckets = new Map<
    number,
    { totalValue: number; totalWeight: number }
  >();

  for (const entry of values) {
    const bucket = Math.round(entry.value * 4) / 4;
    const current = buckets.get(bucket) ?? {
      totalValue: 0,
      totalWeight: 0,
    };

    current.totalValue += entry.value * entry.weight;
    current.totalWeight += entry.weight;
    buckets.set(bucket, current);
  }

  const largestBucket = [...buckets.values()].reduce((largest, candidate) =>
    candidate.totalWeight > largest.totalWeight ? candidate : largest,
  );

  return largestBucket.totalValue / largestBucket.totalWeight;
}

function median(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}
