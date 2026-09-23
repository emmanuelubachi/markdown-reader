import type { MermaidConfig } from "mermaid";

export const MERMAID_FILE_EXTENSIONS = [".mmd", ".mermaid"] as const;

export type MermaidTheme = "dark" | "light";

export function hasMermaidExtension(name: string) {
  const lowerName = name.toLowerCase();

  return MERMAID_FILE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
}

export function isMermaidCodeLanguage(language: null | string | undefined) {
  return language?.toLowerCase() === "mermaid";
}

// A Mermaid file opens as a Markdown document holding one diagram block, so
// preview, source, editing, persistence, and download work unchanged. The
// fence is always longer than any backtick run inside the diagram.
export function toMermaidMarkdown(diagram: string) {
  const longestBacktickRun = Math.max(
    0,
    ...(diagram.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));

  return `${fence}mermaid\n${diagram.trimEnd()}\n${fence}\n`;
}

// Wide diagrams shrink to fit the reading column, but never below this share
// of their natural size; past it the diagram scrolls so labels stay legible.
const MIN_DIAGRAM_SCALE = 0.8;

export function getDiagramMinWidth(svg: string) {
  const width = Number(
    svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"/)?.[1],
  );

  return Number.isFinite(width) && width > 0
    ? Math.round(width * MIN_DIAGRAM_SCALE)
    : null;
}

// Mermaid derives its palette from concrete colors, so these mirror the
// reader's tokens in styles/globals.css instead of reading the CSS variables.
const THEME_VARIABLES: Record<MermaidTheme, Record<string, string>> = {
  dark: {
    background: "#1f2324",
    clusterBkg: "#232829",
    clusterBorder: "#343c3e",
    dropShadow: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))",
    edgeLabelBackground: "#1f2324",
    lineColor: "#7d9498",
    nodeBorder: "#3c7a83",
    noteBkgColor: "#2b3132",
    noteBorderColor: "#404b4d",
    noteTextColor: "#ebeff0",
    primaryBorderColor: "#3c7a83",
    primaryColor: "#263a3d",
    primaryTextColor: "#ebeff0",
    secondaryBorderColor: "#404b4d",
    secondaryColor: "#2b3132",
    secondaryTextColor: "#ebeff0",
    tertiaryBorderColor: "#343c3e",
    tertiaryColor: "#262b2c",
    tertiaryTextColor: "#ebeff0",
    textColor: "#ebeff0",
    titleColor: "#ebeff0",
  },
  light: {
    background: "#ffffff",
    clusterBkg: "#f8fafa",
    clusterBorder: "#dde5e6",
    dropShadow: "drop-shadow(0 1px 2px rgba(24, 26, 27, 0.08))",
    edgeLabelBackground: "#ffffff",
    lineColor: "#6b7a7c",
    nodeBorder: "#9ccdd4",
    noteBkgColor: "#f1f4f4",
    noteBorderColor: "#c5d2d4",
    noteTextColor: "#181a1b",
    primaryBorderColor: "#9ccdd4",
    primaryColor: "#f0fbfc",
    primaryTextColor: "#181a1b",
    secondaryBorderColor: "#c5d2d4",
    secondaryColor: "#f1f4f4",
    secondaryTextColor: "#181a1b",
    tertiaryBorderColor: "#dde5e6",
    tertiaryColor: "#f8fafa",
    tertiaryTextColor: "#181a1b",
    textColor: "#181a1b",
    titleColor: "#181a1b",
  },
};

// Mermaid scopes this to each diagram's SVG. Square nodes get soft corners and
// round nodes (drawn with an rx attribute) stay visibly rounder, so the two
// shapes keep their meaning; paths and polygons keep Mermaid's geometry.
const THEME_CSS = `
  .node rect.label-container:not([rx]) { rx: 6px; ry: 6px; }
  .node rect.label-container[rx] { rx: 14px; ry: 14px; }
  .cluster rect { rx: 12px; ry: 12px; }
`;

export function getMermaidConfig(
  theme: MermaidTheme,
  fontFamily: string,
): MermaidConfig {
  return {
    flowchart: {
      // Mermaid 12 wraps labels at 120px, which breaks short phrases across
      // lines; keep its uniform 120px minimum node width.
      minNodeWidth: 120,
      wrappingWidth: 200,
    },
    fontFamily,
    // Diagrams come from documents, so labels stay text and click handlers
    // stay off.
    securityLevel: "strict",
    startOnLoad: false,
    // A syntax error surfaces in the reader; Mermaid must not inject its own
    // error graphic into the page.
    suppressErrorRendering: true,
    theme: "base",
    themeCSS: THEME_CSS,
    themeVariables: {
      ...THEME_VARIABLES[theme],
      darkMode: theme === "dark",
      fontFamily,
      fontSize: "14px",
    },
  };
}
