type PdfOperatorList = {
  argsArray: unknown[];
  fnArray: ArrayLike<number>;
};

type PdfOperatorCodes = {
  endText: number;
  nextLine: number;
  nextLineSetSpacingShowText: number;
  nextLineShowText: number;
  setTextMatrix: number;
  showSpacedText: number;
  showText: number;
};

export function looksLikeTrackedCapitalText(text: string) {
  const letters = text.replace(/[^A-Z]/g, "").length;
  const spaces = text.replace(/[^\s]/g, "").length;

  return (
    letters >= 5 &&
    /^[A-Z\s]+$/.test(text) &&
    spaces >= Math.max(4, letters * 0.35)
  );
}

export function restoreTrackedCapitalSpacing(
  text: string,
  sourceTextHints: ReadonlyMap<string, string>,
) {
  if (!looksLikeTrackedCapitalText(text)) {
    return text;
  }

  return sourceTextHints.get(compactCapitalText(text)) ?? text;
}

export function extractPdfSourceTextHints(
  operatorList: PdfOperatorList,
  operators: PdfOperatorCodes,
) {
  const hints = new Map<string, string>();
  let segment = "";

  function commitSegment() {
    const normalized = segment.replace(/\s+/g, " ").trim();
    segment = "";

    if (!/^[A-Z ]{5,}$/.test(normalized) || !normalized.includes(" ")) {
      return;
    }

    hints.set(compactCapitalText(normalized), normalized);
  }

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];

    if (
      operation === operators.setTextMatrix ||
      operation === operators.nextLine ||
      operation === operators.endText
    ) {
      commitSegment();
    }

    if (
      operation === operators.showText ||
      operation === operators.showSpacedText
    ) {
      segment += extractGlyphText(args);
      continue;
    }

    if (
      operation === operators.nextLineShowText ||
      operation === operators.nextLineSetSpacingShowText
    ) {
      commitSegment();
      segment += extractGlyphText(args);
    }
  }

  commitSegment();

  return hints;
}

function compactCapitalText(text: string) {
  return text.replace(/\s+/g, "");
}

function extractGlyphText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(extractGlyphText).join("");
  }

  if (
    value &&
    typeof value === "object" &&
    "unicode" in value &&
    typeof value.unicode === "string"
  ) {
    return value.unicode;
  }

  return "";
}
