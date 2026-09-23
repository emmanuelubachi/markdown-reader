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

// Mermaid derives its palette from concrete colors, so these mirror the
// reader's tokens in styles/globals.css instead of reading the CSS variables.
const THEME_VARIABLES: Record<MermaidTheme, Record<string, string>> = {
  dark: {
    background: "#1f2324",
    clusterBkg: "#262b2c",
    clusterBorder: "#373f41",
    edgeLabelBackground: "#1f2324",
    lineColor: "#8ea8ac",
    noteBkgColor: "#2b3132",
    noteBorderColor: "#8ea8ac",
    noteTextColor: "#ebeff0",
    primaryBorderColor: "#58d1e2",
    primaryColor: "#03444a",
    primaryTextColor: "#ebeff0",
    secondaryBorderColor: "#8ea8ac",
    secondaryColor: "#2b3132",
    secondaryTextColor: "#ebeff0",
    tertiaryBorderColor: "#373f41",
    tertiaryColor: "#262b2c",
    tertiaryTextColor: "#ebeff0",
    textColor: "#ebeff0",
    titleColor: "#ebeff0",
  },
  light: {
    background: "#ffffff",
    clusterBkg: "#f6f8f8",
    clusterBorder: "#cfdadc",
    edgeLabelBackground: "#ffffff",
    lineColor: "#4d5a5c",
    noteBkgColor: "#ebeff0",
    noteBorderColor: "#8ea8ac",
    noteTextColor: "#181a1b",
    primaryBorderColor: "#03444a",
    primaryColor: "#ebfafc",
    primaryTextColor: "#181a1b",
    secondaryBorderColor: "#8ea8ac",
    secondaryColor: "#ebeff0",
    secondaryTextColor: "#181a1b",
    tertiaryBorderColor: "#cfdadc",
    tertiaryColor: "#f6f8f8",
    tertiaryTextColor: "#181a1b",
    textColor: "#181a1b",
    titleColor: "#181a1b",
  },
};

export function getMermaidConfig(
  theme: MermaidTheme,
  fontFamily: string,
): MermaidConfig {
  return {
    fontFamily,
    // Diagrams come from documents, so labels stay text and click handlers
    // stay off.
    securityLevel: "strict",
    startOnLoad: false,
    // A syntax error surfaces in the reader; Mermaid must not inject its own
    // error graphic into the page.
    suppressErrorRendering: true,
    theme: "base",
    themeVariables: {
      ...THEME_VARIABLES[theme],
      darkMode: theme === "dark",
      fontFamily,
      fontSize: "14px",
    },
  };
}
