export type MarkdownBlock =
  | {
      id: string;
      level: number;
      text: string;
      type: "heading";
    }
  | {
      text: string;
      type: "paragraph";
    }
  | {
      ordered: boolean;
      items: string[];
      type: "list";
    }
  | {
      text: string;
      type: "blockquote";
    }
  | {
      code: string;
      language: string;
      type: "code";
    }
  | {
      type: "hr";
    }
  | {
      headers: string[];
      rows: string[][];
      type: "table";
    };

export type HeadingBlock = Extract<MarkdownBlock, { type: "heading" }>;

export type LoadedFile = {
  content: string;
  lastModified: number;
  name: string;
  size: number;
  source: "file" | "paste";
};

export type ReaderView = "preview" | "source";

export type ReaderTab = {
  activeHeadingId: null | string;
  error: null | string;
  file: LoadedFile | null;
  id: string;
  view: ReaderView;
};

export type ReaderState = {
  activeTabId: string;
  tabs: ReaderTab[];
};

export type DocumentStats = {
  lines: number;
  readingMinutes: number;
  words: number;
};
