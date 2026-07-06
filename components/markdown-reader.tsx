"use client";

import {
  useEffect,
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
  ListTree,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type ReadAloudStatus = "idle" | "playing" | "paused" | "unsupported";

const ACCEPTED_FILE_TYPES = ".md,.markdown,.mdown,.mkd,text/markdown,text/plain";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function MarkdownReader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

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

  const readAloudChunks = useMemo(() => getReadableChunks(blocks), [blocks]);
  const outlineActiveHeadingId = useMemo(() => {
    if (activeHeadingId && headings.some((heading) => heading.id === activeHeadingId)) {
      return activeHeadingId;
    }

    return headings[0]?.id ?? null;
  }, [activeHeadingId, headings]);

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
      setActiveHeadingId(null);
    } catch {
      setError("The file could not be read. Try exporting it again.");
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files.item(0) ?? undefined);
  }

  function resetReader() {
    setFile(null);
    setError(null);
    setActiveHeadingId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <main className="core-app-shell min-h-screen px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:overflow-hidden lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col gap-4 lg:h-full lg:min-h-0">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#8EA8AC]/35 bg-[#8EA8AC]/15 text-[#03444A] dark:text-[#58D1E2]">
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

        <input
          ref={inputRef}
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(event) =>
            void loadFile(event.currentTarget.files?.item(0) ?? undefined)
          }
          type="file"
        />

        <section
          className={cn(
            "grid min-h-0 flex-1 gap-4 lg:h-full",
            file ? "lg:grid-cols-[340px_minmax(0,1fr)]" : "lg:grid-cols-1",
          )}
        >
          {file ? (
            <aside className="flex min-h-0 flex-col gap-4 lg:h-full">
              <Card className="rounded-lg" size="sm">
                <CardHeader>
                  <CardTitle>File</CardTitle>
                  <CardDescription>Nothing is uploaded to a server.</CardDescription>
                  <CardAction>
                    <Badge
                      variant="outline"
                      className="border-[#8EA8AC]/45 text-[#03444A] dark:text-[#58D1E2]"
                    >
                      Local
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error ? (
                    <Alert variant="destructive">
                      <AlertCircle aria-hidden="true" />
                      <AlertTitle>File not loaded</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <FileSummary
                    file={file}
                    onReset={resetReader}
                    stats={stats}
                  />
                  <Button
                    className="w-full justify-start"
                    onClick={openFilePicker}
                    type="button"
                    variant="outline"
                  >
                    <Upload aria-hidden="true" />
                    Replace markdown file
                  </Button>
                </CardContent>
              </Card>

              <Outline
                activeHeadingId={outlineActiveHeadingId}
                headings={headings}
              />
            </aside>
          ) : null}

          <section className="flex min-h-[580px] flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs ring-1 ring-foreground/5 lg:min-h-0">
            <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {file?.name ?? "No file selected"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file
                        ? `${stats.words.toLocaleString()} words · ${stats.readingMinutes} min read`
                        : "Drop a markdown file into the preview area"}
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
                {file ? (
                  <ReadAloudToolbar
                    chunks={readAloudChunks}
                    key={`${file.name}-${file.lastModified}-${file.size}`}
                  />
                ) : null}
              </div>

              <TabsContent value="preview" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-12rem)] min-h-[500px] lg:h-full lg:min-h-0">
                  <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:px-10">
                    {file ? (
                      <MarkdownPreview
                        blocks={blocks}
                        onActiveHeadingChange={setActiveHeadingId}
                      />
                    ) : (
                      <div className="space-y-4">
                        {error ? (
                          <Alert variant="destructive">
                            <AlertCircle aria-hidden="true" />
                            <AlertTitle>File not loaded</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                          </Alert>
                        ) : null}
                        <EmptyPreview
                          isDragging={isDragging}
                          onClick={openFilePicker}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handleDrop}
                        />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="source" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-12rem)] min-h-[500px] lg:h-full lg:min-h-0">
                  <pre
                    className="min-h-full overflow-x-auto bg-muted/30 p-5 font-mono text-xs leading-relaxed text-foreground sm:p-8"
                    data-readable-root="source"
                  >
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

function UploadDropZone({
  isDragging,
  label,
  onClick,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  supportingText,
}: {
  isDragging: boolean;
  label: string;
  onClick: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  supportingText: string;
}) {
  return (
    <button
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/70 text-center transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "min-h-[420px] p-8",
        isDragging
          ? "border-[#58D1E2] bg-[#58D1E2]/12 text-[#03444A] dark:text-[#58D1E2]"
          : "border-border hover:border-[#58D1E2]/55 hover:bg-muted/35",
      )}
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      type="button"
    >
      <span
        className="grid size-14 place-items-center rounded-lg border border-[#8EA8AC]/35 bg-[#8EA8AC]/15 text-[#03444A] dark:text-[#58D1E2]"
      >
        <Upload className="size-7" aria-hidden="true" />
      </span>
      <span className="space-y-1">
        <span className="block text-lg font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">
          {supportingText}
        </span>
      </span>
    </button>
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
    <div className="rounded-md bg-muted/25 p-3">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-background text-[#03444A] ring-1 ring-border dark:text-[#58D1E2]">
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

function ReadAloudToolbar({ chunks }: { chunks: string[] }) {
  const reader = useReadAloud(chunks);
  const hasReadableText = chunks.length > 0;
  const isPlaying = reader.status === "playing";
  const isPaused = reader.status === "paused";
  const canRead = hasReadableText && reader.status !== "unsupported";
  const currentPosition =
    reader.status === "idle" ? 0 : Math.min(reader.currentIndex + 1, chunks.length);
  const progress = chunks.length > 0 ? (currentPosition / chunks.length) * 100 : 0;
  const statusText = getReadAloudStatusText(
    reader.status,
    currentPosition,
    chunks.length,
  );

  return (
    <div className="mt-3 rounded-md border bg-background/70 p-2.5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Volume2 className="size-4 shrink-0 text-[#03444A] dark:text-[#58D1E2]" />
            <p className="shrink-0 text-sm font-medium">Read aloud</p>
            <p className="truncate text-xs text-muted-foreground">{statusText}</p>
          </div>
          <div
            aria-label="Reading progress"
            aria-valuemax={chunks.length}
            aria-valuemin={0}
            aria-valuenow={currentPosition}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[#03444A] transition-[width] dark:bg-[#58D1E2]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={
                    isPlaying
                      ? "Pause reading"
                      : isPaused
                        ? "Resume reading"
                        : "Read preview aloud from selection"
                  }
                  disabled={!canRead}
                  onClick={
                    isPlaying
                      ? reader.pause
                      : isPaused
                        ? reader.resume
                        : reader.startFromSelection
                  }
                  size="icon-sm"
                  type="button"
                  variant={isPlaying ? "outline" : "default"}
                />
              }
            >
              {isPlaying ? (
                <Pause aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {isPlaying
                ? "Pause"
                : isPaused
                  ? "Resume"
                  : "Read from selection"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Stop reading"
                  disabled={!isPlaying && !isPaused}
                  onClick={reader.stop}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                />
              }
            >
              <Square aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>

          <div className="flex min-w-40 flex-1 items-center gap-2 md:w-48 md:flex-none">
            <label
              className="shrink-0 text-xs font-medium text-muted-foreground"
              htmlFor="read-aloud-rate"
            >
              Speed
            </label>
            <input
              aria-label="Reading speed"
              className="h-1.5 min-w-0 flex-1 accent-[#03444A] dark:accent-[#58D1E2]"
              disabled={!canRead}
              id="read-aloud-rate"
              max="1.5"
              min="0.75"
              onChange={(event) => reader.setRate(Number(event.currentTarget.value))}
              step="0.05"
              type="range"
              value={reader.rate}
            />
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {reader.rate.toFixed(2).replace(/0$/, "")}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function useReadAloud(chunks: string[]) {
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef(chunks);
  const shouldStopRef = useRef(false);
  const rateRef = useRef(1);
  const [speechStatus, setSpeechStatus] = useState<Exclude<
    ReadAloudStatus,
    "unsupported"
  >>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRateState] = useState(1);
  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";
  const status: ReadAloudStatus = speechSupported ? speechStatus : "unsupported";

  useEffect(() => {
    return () => {
      shouldStopRef.current = true;
      synthesisRef.current?.cancel();
    };
  }, []);

  function getSynthesis() {
    if (!speechSupported) {
      return null;
    }

    synthesisRef.current = window.speechSynthesis;

    return synthesisRef.current;
  }

  function speakChunk(index: number) {
    const synthesis = getSynthesis();
    const readableChunks = chunksRef.current;

    if (!synthesis) {
      return;
    }

    if (!readableChunks.length || index >= readableChunks.length) {
      shouldStopRef.current = true;
      utteranceRef.current = null;
      setCurrentIndex(0);
      setSpeechStatus("idle");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(readableChunks[index]);

    utterance.rate = rateRef.current;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (shouldStopRef.current || utteranceRef.current !== utterance) {
        return;
      }

      speakChunk(index + 1);
    };
    utterance.onerror = () => {
      if (shouldStopRef.current) {
        return;
      }

      utteranceRef.current = null;
      setSpeechStatus("idle");
    };

    shouldStopRef.current = false;
    utteranceRef.current = utterance;
    setCurrentIndex(index);
    setSpeechStatus("playing");
    synthesis.speak(utterance);
  }

  function start(startIndex = 0) {
    const synthesis = getSynthesis();
    const safeStartIndex = Math.min(
      Math.max(startIndex, 0),
      Math.max(chunksRef.current.length - 1, 0),
    );

    if (!chunksRef.current.length || !synthesis) {
      return;
    }

    shouldStopRef.current = true;
    synthesis.cancel();
    shouldStopRef.current = false;
    speakChunk(safeStartIndex);
  }

  function startFromSelection() {
    start(getSelectedChunkIndex(chunksRef.current) ?? 0);
  }

  function pause() {
    const synthesis = getSynthesis();

    if (!synthesis || status !== "playing") {
      return;
    }

    synthesis.pause();
    setSpeechStatus("paused");
  }

  function resume() {
    const synthesis = getSynthesis();

    if (!synthesis || status !== "paused") {
      return;
    }

    synthesis.resume();
    setSpeechStatus("playing");
  }

  function stop() {
    shouldStopRef.current = true;
    utteranceRef.current = null;
    synthesisRef.current?.cancel();
    setCurrentIndex(0);
    setSpeechStatus("idle");
  }

  function setRate(nextRate: number) {
    const safeRate = Math.min(1.5, Math.max(0.75, nextRate));

    rateRef.current = safeRate;
    setRateState(safeRate);
  }

  return {
    currentIndex,
    pause,
    rate,
    resume,
    setRate,
    start,
    startFromSelection,
    status,
    stop,
  };
}

function getReadAloudStatusText(
  status: ReadAloudStatus,
  currentPosition: number,
  total: number,
) {
  if (status === "unsupported") {
    return "Voice reading is unavailable in this browser.";
  }

  if (total === 0) {
    return "No readable preview text.";
  }

  if (status === "playing") {
    return `Reading ${currentPosition} of ${total}`;
  }

  if (status === "paused") {
    return `Paused at ${currentPosition} of ${total}`;
  }

  return `${total} ${total === 1 ? "passage" : "passages"} ready`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 px-2 py-2">
      <dt className="text-[0.7rem] font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Outline({
  activeHeadingId,
  headings,
}: {
  activeHeadingId: null | string;
  headings: Extract<MarkdownBlock, { type: "heading" }>[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/5">
      <div className="flex items-center gap-2">
        <ListTree className="size-4 text-[#03444A] dark:text-[#58D1E2]" />
        <h2 className="text-sm font-medium">Outline</h2>
      </div>
      {headings.length > 0 ? (
        <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
          {headings.slice(0, 36).map((heading) => {
            const isActive = heading.id === activeHeadingId;

            return (
              <a
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block truncate rounded-md px-2 py-1.5 text-sm transition hover:bg-muted hover:text-foreground",
                  isActive
                    ? "bg-[#58D1E2]/12 text-foreground ring-1 ring-[#58D1E2]/25"
                    : "text-muted-foreground",
                )}
                href={`#${heading.id}`}
                key={heading.id}
                style={{
                  paddingLeft: `${(heading.level - 1) * 0.75 + 0.5}rem`,
                }}
              >
                {heading.text}
              </a>
            );
          })}
        </nav>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Headings from the document will appear here.
        </p>
      )}
    </div>
  );
}

function EmptyPreview({
  isDragging,
  onClick,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  isDragging: boolean;
  onClick: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <UploadDropZone
      isDragging={isDragging}
      label="Drop markdown here"
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      supportingText="or choose a local .md file"
    />
  );
}

function MarkdownPreview({
  blocks,
  onActiveHeadingChange,
}: {
  blocks: MarkdownBlock[];
  onActiveHeadingChange: (headingId: string) => void;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const headingSignature = useMemo(
    () =>
      blocks
        .filter((block) => block.type === "heading")
        .map((heading) => heading.id)
        .join("\n"),
    [blocks],
  );

  useEffect(() => {
    const article = articleRef.current;

    if (!article || typeof IntersectionObserver === "undefined") {
      return;
    }

    const headingElements = Array.from(
      article.querySelectorAll<HTMLElement>("[data-markdown-heading]"),
    );

    if (headingElements.length === 0) {
      return;
    }

    const scrollRoot = article.closest("[data-slot='scroll-area-viewport']");
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeading = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];

        if (visibleHeading?.target.id) {
          onActiveHeadingChange(visibleHeading.target.id);
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-12% 0px -72% 0px",
        threshold: [0, 1],
      },
    );

    headingElements.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [headingSignature, onActiveHeadingChange]);

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This markdown file is empty.
      </div>
    );
  }

  return (
    <article
      className="markdown-preview"
      data-readable-root="preview"
      ref={articleRef}
    >
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
          <h1 data-markdown-heading id={block.id} key={key}>
            {children}
          </h1>
        );
      }

      if (block.level === 2) {
        return (
          <h2 data-markdown-heading id={block.id} key={key}>
            {children}
          </h2>
        );
      }

      if (block.level === 3) {
        return (
          <h3 data-markdown-heading id={block.id} key={key}>
            {children}
          </h3>
        );
      }

      if (block.level === 4) {
        return (
          <h4 data-markdown-heading id={block.id} key={key}>
            {children}
          </h4>
        );
      }

      if (block.level === 5) {
        return (
          <h5 data-markdown-heading id={block.id} key={key}>
            {children}
          </h5>
        );
      }

      return (
        <h6 data-markdown-heading id={block.id} key={key}>
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

function getReadableChunks(blocks: MarkdownBlock[]) {
  return blocks.flatMap((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return splitSpeechText(block.text);
      case "blockquote":
        return splitSpeechText(`Quote. ${block.text}`);
      case "list":
        return block.items.flatMap((item, index) =>
          splitSpeechText(`Item ${index + 1}. ${item}`),
        );
      case "table": {
        const headers = block.headers.map(toPlainSpeechText);
        const rows =
          block.rows.length > 0
            ? block.rows
            : block.headers.length > 0
              ? [block.headers]
              : [];

        return rows.flatMap((row) => {
          const rowText = row
            .map((cell, index) => {
              const text = toPlainSpeechText(cell);
              const header = headers[index];

              if (!text) {
                return "";
              }

              return header && header !== text ? `${header}: ${text}` : text;
            })
            .filter(Boolean)
            .join(". ");

          return splitSpeechText(rowText);
        });
      }
      case "code":
      case "hr":
        return [];
    }
  });
}

function splitSpeechText(text: string) {
  const plainText = toPlainSpeechText(text);

  if (!plainText) {
    return [];
  }

  const sentences = plainText.match(/[^.!?]+[.!?]*/g) ?? [plainText];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (!trimmedSentence) {
      continue;
    }

    const nextChunk = currentChunk
      ? `${currentChunk} ${trimmedSentence}`
      : trimmedSentence;

    if (nextChunk.length > 220 && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = trimmedSentence;
    } else {
      currentChunk = nextChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function toPlainSpeechText(text: string) {
  return text
    .replace(/\r\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSelectedChunkIndex(chunks: string[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || !selectionWithinReadableRoot(selection)) {
    return null;
  }

  const selectedText = normalizeSpeechMatch(selection.toString());

  if (!selectedText) {
    return null;
  }

  const selectedWords = selectedText.split(" ").filter(Boolean);
  const chunkMatches = chunks.map((chunk, index) => ({
    index,
    text: normalizeSpeechMatch(chunk),
  }));

  const exactMatch = chunkMatches.find(
    (chunk) => chunk.text.includes(selectedText) || selectedText.includes(chunk.text),
  );

  if (exactMatch) {
    return exactMatch.index;
  }

  const selectedPrefix = selectedWords.slice(0, 8).join(" ");
  const prefixMatch = chunkMatches.find(
    (chunk) => selectedPrefix.length > 8 && chunk.text.includes(selectedPrefix),
  );

  if (prefixMatch) {
    return prefixMatch.index;
  }

  const bestMatch = chunkMatches
    .map((chunk) => ({
      index: chunk.index,
      score: getWordOverlapScore(selectedWords, chunk.text),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch && bestMatch.score >= 2 ? bestMatch.index : null;
}

function selectionWithinReadableRoot(selection: Selection) {
  return (
    nodeWithinReadableRoot(selection.anchorNode) ||
    nodeWithinReadableRoot(selection.focusNode)
  );
}

function nodeWithinReadableRoot(node: Node | null) {
  if (!node) {
    return false;
  }

  const element =
    node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;

  return Boolean(element?.closest("[data-readable-root]"));
}

function normalizeSpeechMatch(text: string) {
  return toPlainSpeechText(text)
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWordOverlapScore(selectedWords: string[], chunkText: string) {
  const chunkWords = new Set(chunkText.split(" ").filter(Boolean));

  return selectedWords.reduce(
    (score, word) => (chunkWords.has(word) ? score + 1 : score),
    0,
  );
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
