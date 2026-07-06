"use client";

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Braces,
  FileText,
  Heading2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type MarkdownBlock =
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

type LoadedFile = {
  content: string;
  lastModified: number;
  name: string;
  size: number;
};

type DocumentStats = {
  lines: number;
  readingMinutes: number;
  words: number;
};

const ACCEPTED_FILE_TYPES = ".md,.markdown,.mdown,.mkd,text/markdown,text/plain";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function MarkdownReader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const blocks = useMemo(
    () => parseMarkdown(file?.content ?? ""),
    [file?.content],
  );

  const stats = useMemo(
    () => getDocumentStats(file?.content ?? ""),
    [file?.content],
  );

  const headings = useMemo(
    () => blocks.filter((block) => block.type === "heading"),
    [blocks],
  );

  async function loadFile(selectedFile: File | undefined) {
    if (!selectedFile) {
      return;
    }

    if (!isMarkdownFile(selectedFile)) {
      setError("Choose a markdown file with a .md or .markdown extension.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("This file is larger than 5 MB. Try a smaller markdown file.");
      return;
    }

    try {
      const content = await selectedFile.text();
      setFile({
        content,
        lastModified: selectedFile.lastModified,
        name: selectedFile.name,
        size: selectedFile.size,
      });
      setError(null);
    } catch {
      setError("The file could not be read. Try exporting it again.");
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files.item(0) ?? undefined);
  }

  function resetReader() {
    setFile(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.9_0.07_190_/_0.42),transparent_28rem),linear-gradient(135deg,oklch(0.99_0.01_110),oklch(0.98_0.02_250))] px-4 py-4 text-foreground dark:bg-[linear-gradient(135deg,oklch(0.16_0.02_230),oklch(0.12_0.01_120))] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">
                Markdown Reader
              </h1>
              <p className="text-sm text-muted-foreground">
                Local preview for readable markdown files
              </p>
            </div>
          </div>
          <ModeToggle />
        </header>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4">
            <Card className="rounded-lg" size="sm">
              <CardHeader>
                <CardTitle>File</CardTitle>
                <CardDescription>Nothing is uploaded to a server.</CardDescription>
                <CardAction>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  >
                    Local
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={inputRef}
                  accept={ACCEPTED_FILE_TYPES}
                  className="sr-only"
                  onChange={(event) =>
                    void loadFile(event.currentTarget.files?.item(0) ?? undefined)
                  }
                  type="file"
                />

                <button
                  type="button"
                  className={cn(
                    "flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/70 p-6 text-center transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isDragging
                      ? "border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-200"
                      : "border-border hover:border-teal-500/60 hover:bg-teal-500/5",
                  )}
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <span className="grid size-12 place-items-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                    <Upload className="size-6" aria-hidden="true" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-base font-medium">
                      Drop markdown here
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      or choose a .md file
                    </span>
                  </span>
                </button>

                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>File not loaded</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                {file ? (
                  <FileSummary
                    file={file}
                    onReset={resetReader}
                    stats={stats}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Outline headings={headings} />
          </aside>

          <section className="flex min-h-[580px] flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5">
            <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {file?.name ?? "No file selected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file
                      ? `${stats.words.toLocaleString()} words`
                      : "Preview will appear here"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TabsList aria-label="Document view">
                    <TabsTrigger value="preview">
                      <BookOpen aria-hidden="true" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="source">
                      <Braces aria-hidden="true" />
                      Source
                    </TabsTrigger>
                  </TabsList>
                  {file ? (
                    <Button
                      aria-label="Clear file"
                      onClick={resetReader}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <TabsContent value="preview" className="min-h-0">
                <ScrollArea className="h-[calc(100vh-12rem)] min-h-[500px]">
                  <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:px-10">
                    {file ? (
                      <MarkdownPreview blocks={blocks} />
                    ) : (
                      <EmptyPreview />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="source" className="min-h-0">
                <ScrollArea className="h-[calc(100vh-12rem)] min-h-[500px]">
                  <pre className="min-h-full overflow-x-auto bg-muted/30 p-5 font-mono text-xs leading-relaxed text-foreground sm:p-8">
                    {file?.content ?? "Open a markdown file to view its source."}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </section>
        </section>
      </div>
    </main>
  );
}

function FileSummary({
  file,
  onReset,
  stats,
}: {
  file: LoadedFile;
  onReset: () => void;
  stats: DocumentStats;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-background text-sky-700 ring-1 ring-border dark:text-sky-300">
          <FileText className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)} · edited {formatDate(file.lastModified)}
          </p>
        </div>
        <Button
          aria-label="Reset file"
          onClick={onReset}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Words" value={stats.words.toLocaleString()} />
        <Stat label="Lines" value={stats.lines.toLocaleString()} />
        <Stat label="Read" value={`${stats.readingMinutes}m`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background px-2 py-2 ring-1 ring-border">
      <dt className="text-[0.7rem] font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Outline({ headings }: { headings: Extract<MarkdownBlock, { type: "heading" }>[] }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/5">
      <div className="flex items-center gap-2">
        <Heading2 className="size-4 text-indigo-600 dark:text-indigo-300" />
        <h2 className="text-sm font-medium">Outline</h2>
      </div>
      {headings.length > 0 ? (
        <nav className="mt-3 max-h-72 space-y-1 overflow-auto pr-1">
          {headings.slice(0, 24).map((heading) => (
            <a
              className="block truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href={`#${heading.id}`}
              key={heading.id}
              style={{ paddingLeft: `${(heading.level - 1) * 0.75 + 0.5}rem` }}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Headings from the document will appear here.
        </p>
      )}
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed bg-background/60 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300">
        <FileText className="size-7" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No markdown loaded</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Choose a file from the panel to start reading.
      </p>
    </div>
  );
}

function MarkdownPreview({ blocks }: { blocks: MarkdownBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This markdown file is empty.
      </div>
    );
  }

  return (
    <article className="markdown-preview">
      {blocks.map((block, index) => renderBlock(block, index))}
    </article>
  );
}

function renderBlock(block: MarkdownBlock, index: number) {
  switch (block.type) {
    case "heading": {
      const children = renderInline(block.text, `${index}-heading`);
      const key = `${block.id}-${index}`;

      if (block.level === 1) {
        return (
          <h1 id={block.id} key={key}>
            {children}
          </h1>
        );
      }

      if (block.level === 2) {
        return (
          <h2 id={block.id} key={key}>
            {children}
          </h2>
        );
      }

      if (block.level === 3) {
        return (
          <h3 id={block.id} key={key}>
            {children}
          </h3>
        );
      }

      if (block.level === 4) {
        return (
          <h4 id={block.id} key={key}>
            {children}
          </h4>
        );
      }

      if (block.level === 5) {
        return (
          <h5 id={block.id} key={key}>
            {children}
          </h5>
        );
      }

      return (
        <h6 id={block.id} key={key}>
          {children}
        </h6>
      );
    }
    case "paragraph":
      return <p key={`paragraph-${index}`}>{renderInline(block.text, `${index}`)}</p>;
    case "blockquote":
      return (
        <blockquote key={`quote-${index}`}>
          <p>{renderInline(block.text, `${index}-quote`)}</p>
        </blockquote>
      );
    case "code":
      return (
        <figure key={`code-${index}`}>
          {block.language ? <figcaption>{block.language}</figcaption> : null}
          <pre>
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case "hr":
      return <hr key={`rule-${index}`} />;
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";

      return (
        <ListTag key={`list-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>
              {renderInline(item, `${index}-item-${itemIndex}`)}
            </li>
          ))}
        </ListTag>
      );
    }
    case "table":
      return (
        <div className="table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {block.headers.map((header, headerIndex) => (
                  <th key={`${index}-head-${headerIndex}`}>
                    {renderInline(header, `${index}-head-${headerIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${index}-row-${rowIndex}`}>
                  {block.headers.map((_, cellIndex) => (
                    <td key={`${index}-cell-${rowIndex}-${cellIndex}`}>
                      {renderInline(
                        row[cellIndex] ?? "",
                        `${index}-cell-${rowIndex}-${cellIndex}`,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  const slugCounts = new Map<string, number>();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trimEnd() ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^(```|~~~)\s*([\w-]+)?\s*$/);

    if (fence) {
      const fenceMarker = fence[1];
      const codeLines: string[] = [];
      index += 1;

      while (
        index < lines.length &&
        !lines[index]?.trimEnd().startsWith(fenceMarker)
      ) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language: fence[2] ?? "",
        type: "code",
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (heading) {
      const text = heading[2].trim();

      blocks.push({
        id: uniqueSlug(text, slugCounts),
        level: heading[1].length,
        text,
        type: "heading",
      });
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const parsedTable = parseTable(lines, index);
      blocks.push(parsedTable.block);
      index = parsedTable.nextIndex;
      continue;
    }

    const listMatch = getListMatch(line);

    if (listMatch) {
      const ordered = listMatch.ordered;
      const items: string[] = [];

      while (index < lines.length) {
        const nextListMatch = getListMatch(lines[index] ?? "");

        if (!nextListMatch || nextListMatch.ordered !== ordered) {
          break;
        }

        items.push(nextListMatch.text);
        index += 1;
      }

      blocks.push({ items, ordered, type: "list" });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }

      blocks.push({
        text: quoteLines.join(" ").trim(),
        type: "blockquote",
      });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !isBlockStart(lines, index)
    ) {
      paragraphLines.push(lines[index]?.trim() ?? "");
      index += 1;
    }

    blocks.push({
      text: paragraphLines.join(" "),
      type: "paragraph",
    });
  }

  return blocks;
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index]?.trimEnd() ?? "";

  return (
    /^(```|~~~)/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^([-*_])(?:\s*\1){2,}\s*$/.test(line.trim()) ||
    Boolean(getListMatch(line)) ||
    /^\s*>\s?/.test(line) ||
    isTableStart(lines, index)
  );
}

function getListMatch(line: string) {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);

  if (unordered) {
    return {
      ordered: false,
      text: unordered[1].trim(),
    };
  }

  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

  if (ordered) {
    return {
      ordered: true,
      text: ordered[1].trim(),
    };
  }

  return null;
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index]?.trim() ?? "";
  const divider = lines[index + 1]?.trim() ?? "";
  const headerCells = splitTableRow(header);

  return (
    header.includes("|") &&
    headerCells.length > 1 &&
    isDividerRow(divider) &&
    splitTableRow(divider).length === headerCells.length
  );
}

function parseTable(lines: string[], startIndex: number) {
  const headers = splitTableRow(lines[startIndex] ?? "");
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";

    if (!line || !line.includes("|") || isDividerRow(line)) {
      break;
    }

    rows.push(splitTableRow(line));
    index += 1;
  }

  return {
    block: {
      headers,
      rows,
      type: "table" as const,
    },
    nextIndex: index,
  };
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isDividerRow(row: string) {
  const cells = splitTableRow(row);

  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(!?\[[^\]]+\]\([^)\s]+(?:\s+"[^"]*")?\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(renderInlineToken(token, `${keyPrefix}-${match.index}`));
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderInlineToken(token: string, key: string): ReactNode {
  const image = token.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);

  if (image) {
    const alt = image[1];
    const src = sanitizeImageSrc(image[2]);

    if (!src) {
      return (
        <span className="image-fallback" key={key}>
          {alt || image[2]}
        </span>
      );
    }

    // Markdown image dimensions are user-authored, so Next Image cannot know them here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} key={key} src={src} />;
  }

  const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);

  if (link) {
    const href = sanitizeHref(link[2]);

    if (!href) {
      return <span key={key}>{renderInline(link[1], `${key}-label`)}</span>;
    }

    return (
      <a href={href} key={key} rel="noreferrer" target="_blank">
        {renderInline(link[1], `${key}-label`)}
      </a>
    );
  }

  if (token.startsWith("`") && token.endsWith("`")) {
    return <code key={key}>{token.slice(1, -1)}</code>;
  }

  if (
    (token.startsWith("**") && token.endsWith("**")) ||
    (token.startsWith("__") && token.endsWith("__"))
  ) {
    return (
      <strong key={key}>{renderInline(token.slice(2, -2), `${key}-strong`)}</strong>
    );
  }

  if (
    (token.startsWith("*") && token.endsWith("*")) ||
    (token.startsWith("_") && token.endsWith("_"))
  ) {
    return <em key={key}>{renderInline(token.slice(1, -1), `${key}-em`)}</em>;
  }

  return token;
}

function sanitizeHref(rawHref: string) {
  if (rawHref.startsWith("#") || rawHref.startsWith("/")) {
    return rawHref;
  }

  try {
    const url = new URL(rawHref);
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];

    return allowedProtocols.includes(url.protocol) ? rawHref : null;
  } catch {
    return null;
  }
}

function sanitizeImageSrc(rawSrc: string) {
  try {
    const url = new URL(rawSrc);
    const isRemoteImage = ["http:", "https:"].includes(url.protocol);
    const isInlineImage =
      url.protocol === "data:" && rawSrc.toLowerCase().startsWith("data:image/");

    return isRemoteImage || isInlineImage ? rawSrc : null;
  } catch {
    return null;
  }
}

function isMarkdownFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  const hasMarkdownExtension =
    normalizedName.endsWith(".md") ||
    normalizedName.endsWith(".markdown") ||
    normalizedName.endsWith(".mdown") ||
    normalizedName.endsWith(".mkd");

  return (
    hasMarkdownExtension ||
    file.type === "text/markdown" ||
    file.type === "text/plain"
  );
}

function getDocumentStats(content: string): DocumentStats {
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[>#*_`~|[\]()!-]/g, " ");
  const words = plainText.match(/\b[\w'-]+\b/g)?.length ?? 0;

  return {
    lines: content ? content.replace(/\r\n?/g, "\n").split("\n").length : 0,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    words,
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function uniqueSlug(text: string, counts: Map<string, number>) {
  const baseSlug =
    text
      .toLowerCase()
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
  const count = counts.get(baseSlug) ?? 0;

  counts.set(baseSlug, count + 1);

  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
}
