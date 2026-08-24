import { describe, expect, it } from "vitest";

import {
  extractPdfSourceTextHints,
  looksLikeTrackedCapitalText,
  restoreTrackedCapitalSpacing,
} from "@/lib/pdf/pdf-source-text";

const operators = {
  endText: 1,
  nextLine: 2,
  nextLineSetSpacingShowText: 3,
  nextLineShowText: 4,
  setTextMatrix: 5,
  showSpacedText: 6,
  showText: 7,
};

describe("PDF source text hints", () => {
  it("recovers real word boundaries from a tracked-capital glyph stream", () => {
    const source = "CHINA GLOBAL MEDIATION TRACKER";
    const hints = extractPdfSourceTextHints(
      {
        fnArray: [operators.setTextMatrix, operators.showText, operators.endText],
        argsArray: [
          [],
          [[...source].map((unicode) => ({ unicode }))],
          [],
        ],
      },
      operators,
    );

    expect(
      restoreTrackedCapitalSpacing(
        "C H I N A G L O B A L M E D I AT I O N T R A C K E R",
        hints,
      ),
    ).toBe(source);
  });

  it("does not rewrite ordinary uppercase labels", () => {
    expect(looksLikeTrackedCapitalText("CHINA GLOBAL MEDIATION TRACKER")).toBe(
      false,
    );
  });
});
