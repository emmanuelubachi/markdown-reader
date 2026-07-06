"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Braces,
  ClipboardPaste,
  FileText,
  ListTree,
  Pause,
  Play,
  Plus,
  Search,
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
  source: "file" | "paste";
};

type ReaderView = "preview" | "source";

type ReaderTab = {
  activeHeadingId: null | string;
  error: null | string;
  file: LoadedFile | null;
  id: string;
  view: ReaderView;
};

type ReaderState = {
  activeTabId: string;
  tabs: ReaderTab[];
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
  const [isDragging, setIsDragging] = useState(false);
  const [readerState, setReaderState] = useState<ReaderState>(() => {
    const tab = createReaderTab();

    return {
      activeTabId: tab.id,
      tabs: [tab],
    };
  });
  const activeTab = useMemo(
    () =>
      readerState.tabs.find((tab) => tab.id === readerState.activeTabId) ??
      readerState.tabs[0]!,
    [readerState.activeTabId, readerState.tabs],
  );
  const file = activeTab.file;
  const error = activeTab.error;
  const activeHeadingId = activeTab.activeHeadingId;
  const documentView = activeTab.view;

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

  function updateTab(tabId: string, updates: Partial<ReaderTab>) {
    setReaderState((currentState) => {
      if (!currentState.tabs.some((tab) => tab.id === tabId)) {
        return currentState;
      }

      return {
        ...currentState,
        tabs: currentState.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updates } : tab,
        ),
      };
    });
  }

  function loadTabContent(tabId: string, nextFile: LoadedFile) {
    updateTab(tabId, {
      activeHeadingId: null,
      error: null,
      file: nextFile,
      view: "preview",
    });
  }

  async function loadFile(
    selectedFile: File | undefined,
    tabId = activeTab.id,
  ) {
    if (!selectedFile) {
      return;
    }

    if (!isMarkdownFile(selectedFile)) {
      updateTab(tabId, {
        error: "Choose a markdown file with a .md or .markdown extension.",
      });
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      updateTab(tabId, {
        error: "This file is larger than 5 MB. Try a smaller markdown file.",
      });
      return;
    }

    try {
      const content = await selectedFile.text();
      loadTabContent(tabId, {
        content,
        lastModified: selectedFile.lastModified,
        name: selectedFile.name,
        size: selectedFile.size,
        source: "file",
      });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch {
      updateTab(tabId, {
        error: "The file could not be read. Try exporting it again.",
      });
    }
  }

  function loadMarkdownText(content: string, tabId = activeTab.id) {
    if (!content.trim()) {
      updateTab(tabId, {
        error: "The clipboard does not contain any markdown text.",
      });
      return;
    }

    const size = new Blob([content]).size;

    if (size > MAX_FILE_SIZE) {
      updateTab(tabId, {
        error: "The pasted markdown is larger than 5 MB. Try a smaller selection.",
      });
      return;
    }

    loadTabContent(tabId, {
      content,
      lastModified: Date.now(),
      name: getPastedDocumentName(content),
      size,
      source: "paste",
    });
  }

  async function pasteMarkdownFromClipboard(tabId = activeTab.id) {
    if (!navigator.clipboard?.readText) {
      updateTab(tabId, {
        error: "Clipboard paste is unavailable in this browser.",
      });
      return;
    }

    try {
      loadMarkdownText(await navigator.clipboard.readText(), tabId);
    } catch {
      updateTab(tabId, {
        error: "Clipboard access was blocked. Try pasting with the keyboard.",
      });
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
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    void loadFile(event.dataTransfer.files.item(0) ?? undefined, activeTab.id);
  }

  function resetReader() {
    updateTab(activeTab.id, {
      activeHeadingId: null,
      error: null,
      file: null,
      view: "preview",
    });
  }

  function createNewTab() {
    const nextTab = createReaderTab();

    setReaderState((currentState) => ({
      activeTabId: nextTab.id,
      tabs: [...currentState.tabs, nextTab],
    }));
  }

  function selectTab(tabId: string) {
    setReaderState((currentState) => ({
      ...currentState,
      activeTabId: tabId,
    }));
  }

  function closeTab(tabId: string) {
    setReaderState((currentState) => {
      const closedIndex = currentState.tabs.findIndex((tab) => tab.id === tabId);

      if (closedIndex === -1) {
        return currentState;
      }

      const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);

      if (nextTabs.length === 0) {
        const nextTab = createReaderTab();

        return {
          activeTabId: nextTab.id,
          tabs: [nextTab],
        };
      }

      const activeTabStillExists = nextTabs.some(
        (tab) => tab.id === currentState.activeTabId,
      );
      const fallbackTab =
        nextTabs[Math.min(Math.max(closedIndex, 0), nextTabs.length - 1)] ??
        nextTabs[0]!;

      return {
        activeTabId:
          tabId === currentState.activeTabId || !activeTabStillExists
            ? fallbackTab.id
            : currentState.activeTabId,
        tabs: nextTabs,
      };
    });
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (event.defaultPrevented || isEditablePasteTarget(event.target)) {
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");

    if (!pastedText) {
      return;
    }

    event.preventDefault();
    loadMarkdownText(pastedText, activeTab.id);
  }

  return (
    <main
      className="core-app-shell flex h-screen flex-col overflow-hidden text-foreground"
      onPaste={handlePaste}
    >
      <Tabs
        className="flex min-h-0 flex-1 flex-col gap-0"
        onValueChange={(value) =>
          updateTab(activeTab.id, {
            view: value === "source" && file ? "source" : "preview",
          })
        }
        value={documentView}
      >
        {/* Browser chrome: tab strip + address-bar toolbar */}
        <div className="shrink-0 border-b border-border/70 bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/30">
          <ReaderTabs
            activeTabId={readerState.activeTabId}
            onCloseTab={closeTab}
            onNewTab={createNewTab}
            onPasteMarkdown={() => void pasteMarkdownFromClipboard(activeTab.id)}
            onSelectTab={selectTab}
            tabs={readerState.tabs}
          />

          <div className="flex items-center gap-2 px-2.5 py-2 sm:px-3">
            <div className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
              <div className="grid size-8 place-items-center rounded-md border border-[#8EA8AC]/35 bg-[#8EA8AC]/15 text-[#03444A] dark:text-[#58D1E2]">
                <BookOpen className="size-4" aria-hidden="true" />
              </div>
            </div>

            {/* Address bar */}
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 shadow-xs ring-1 ring-foreground/5">
              {file ? (
                <FileText
                  className="size-4 shrink-0 text-[#03444A] dark:text-[#58D1E2]"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="truncate text-sm font-medium">
                {file?.name ?? "Markdown Reader"}
              </span>
              <span className="ml-auto hidden shrink-0 truncate text-xs text-muted-foreground md:inline">
                {file
                  ? `${stats.words.toLocaleString()} words · ${stats.readingMinutes} min read`
                  : "Choose, drop, or paste markdown to start"}
              </span>
              {file ? (
                <Badge
                  variant="outline"
                  className="hidden shrink-0 border-[#8EA8AC]/45 text-[#03444A] lg:inline-flex dark:text-[#58D1E2]"
                >
                  Local
                </Badge>
              ) : null}
            </div>

            <TabsList aria-label="Document view" className="shrink-0">
              <TabsTrigger value="preview">
                <BookOpen aria-hidden="true" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
              {file ? (
                <TabsTrigger value="source">
                  <Braces aria-hidden="true" />
                  <span className="hidden sm:inline">Source</span>
                </TabsTrigger>
              ) : null}
            </TabsList>

            {file ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Clear current tab"
                      className="shrink-0"
                      onClick={resetReader}
                      size="icon"
                      type="button"
                      variant="outline"
                    />
                  }
                >
                  <X aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Close document</TooltipContent>
              </Tooltip>
            ) : null}

            <ModeToggle />
          </div>
        </div>

        <input
          ref={inputRef}
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(event) =>
            void loadFile(
              event.currentTarget.files?.item(0) ?? undefined,
              activeTab.id,
            )
          }
          type="file"
        />

        {file ? (
          <div className="shrink-0 border-b border-border/70 bg-muted/25 px-2.5 py-2 sm:px-3">
            <ReadAloudToolbar
              chunks={readAloudChunks}
              key={`${activeTab.id}-${file.name}-${file.lastModified}-${file.size}`}
            />
          </div>
        ) : null}

        {/* Body: sidebar + content viewport */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {file ? (
            <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 lg:flex xl:w-80">
              <div className="space-y-3 border-b border-border/70 p-3">
                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>File not loaded</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <FileSummary file={file} onReset={resetReader} stats={stats} />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="justify-center"
                    onClick={openFilePicker}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Upload aria-hidden="true" />
                    Open
                  </Button>
                  <Button
                    className="justify-center"
                    onClick={() => void pasteMarkdownFromClipboard(activeTab.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ClipboardPaste aria-hidden="true" />
                    Paste
                  </Button>
                </div>
              </div>

              <Outline
                activeHeadingId={outlineActiveHeadingId}
                headings={headings}
              />
            </aside>
          ) : null}

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card text-card-foreground">
            <TabsContent
              value="preview"
              className="mt-0 min-h-0 flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div
                  className={cn(
                    file
                      ? "mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:px-10"
                      : "flex min-h-full w-full items-center justify-center p-4 sm:p-6",
                  )}
                >
                  {file ? (
                    <MarkdownPreview
                      blocks={blocks}
                      onActiveHeadingChange={(headingId) =>
                        updateTab(activeTab.id, { activeHeadingId: headingId })
                      }
                    />
                  ) : (
                    <div className="flex w-full max-w-md flex-col gap-4">
                      {error ? (
                        <Alert variant="destructive">
                          <AlertCircle aria-hidden="true" />
                          <AlertTitle>File not loaded</AlertTitle>
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      ) : null}
                      <EmptyPreview
                        isDragging={isDragging}
                        onChooseFile={openFilePicker}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDrop}
                        onPaste={handlePaste}
                        onPasteMarkdown={() =>
                          void pasteMarkdownFromClipboard(activeTab.id)
                        }
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {file ? (
              <TabsContent
                value="source"
                className="mt-0 min-h-0 flex-1 overflow-hidden"
              >
                <ScrollArea className="h-full">
                  <pre
                    className="min-h-full overflow-x-auto bg-muted/30 p-5 font-mono text-xs leading-relaxed text-foreground sm:p-8"
                    data-readable-root="source"
                  >
                    {file.content}
                  </pre>
                </ScrollArea>
              </TabsContent>
            ) : null}
          </section>
        </div>
      </Tabs>
    </main>
  );
}

function ReaderTabs({
  activeTabId,
  onCloseTab,
  onNewTab,
  onPasteMarkdown,
  onSelectTab,
  tabs,
}: {
  activeTabId: string;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onPasteMarkdown: () => void;
  onSelectTab: (tabId: string) => void;
  tabs: ReaderTab[];
}) {
  return (
    <div className="flex items-end gap-1 px-2 pt-2">
      <div
        aria-label="Reader tabs"
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const label = getReaderTabLabel(tab, index);
          const canClose = tabs.length > 1 || Boolean(tab.file) || Boolean(tab.error);

          return (
            <div
              className={cn(
                "group relative flex min-w-36 max-w-56 shrink-0 items-center rounded-t-lg border border-b-0 text-sm transition",
                isActive
                  ? "z-10 border-border/70 bg-background text-foreground -mb-px pb-px shadow-[0_-1px_2px_rgba(0,0,0,0.04)]"
                  : "border-transparent bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
              key={tab.id}
            >
              <button
                aria-selected={isActive}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-t-lg py-2 pl-3 pr-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => onSelectTab(tab.id)}
                role="tab"
                title={label}
                type="button"
              >
                {tab.error ? (
                  <AlertCircle
                    className="size-3.5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                ) : (
                  <FileText
                    className={cn(
                      "size-3.5 shrink-0",
                      isActive
                        ? "text-[#03444A] dark:text-[#58D1E2]"
                        : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{label}</span>
              </button>
              {canClose ? (
                <Button
                  aria-label={`Close ${label}`}
                  className={cn(
                    "mr-1.5 size-5 shrink-0 opacity-70 transition group-hover:opacity-100",
                    !isActive && "sm:opacity-0 sm:group-hover:opacity-100",
                  )}
                  onClick={() => onCloseTab(tab.id)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          );
        })}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="New reader tab"
                className="mb-1 ml-0.5 size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                onClick={onNewTab}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <Plus aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>New tab</TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Paste markdown into active tab"
              className="mb-1 size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              onClick={onPasteMarkdown}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <ClipboardPaste aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Paste into active tab</TooltipContent>
      </Tooltip>
    </div>
  );
}

function UploadDropZone({
  isDragging,
  onChooseFile,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onPaste,
  onPasteMarkdown,
}: {
  isDragging: boolean;
  onChooseFile: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onPasteMarkdown: () => void;
}) {
  return (
    <div
      aria-label="Markdown input area"
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-background/70 px-6 py-10 text-center transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isDragging
          ? "border-[#58D1E2] bg-[#58D1E2]/12 text-[#03444A] shadow-[0_0_0_1px_color-mix(in_srgb,var(--core-teal)_35%,transparent)] dark:text-[#58D1E2]"
          : "border-border hover:border-[#58D1E2]/55 hover:bg-muted/35",
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPaste={onPaste}
      tabIndex={0}
    >
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <span className="grid size-14 place-items-center rounded-lg border border-[#8EA8AC]/35 bg-[#8EA8AC]/15 text-[#03444A] dark:text-[#58D1E2]">
          <Upload className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">Open a Markdown file</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Drop a markdown file anywhere in this panel, choose a file, or paste
          copied markdown text.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={onChooseFile} type="button">
            <Upload aria-hidden="true" />
            Choose file
          </Button>
          <Button onClick={onPasteMarkdown} type="button" variant="outline">
            <ClipboardPaste aria-hidden="true" />
            Paste markdown
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Files and pasted text stay in your browser. Nothing is uploaded.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[".md", ".markdown", "Max 5 MB", "Local only"].map((label) => (
            <Badge
              className="border-[#8EA8AC]/35 bg-background/70 text-muted-foreground"
              key={label}
              variant="outline"
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
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
            {formatBytes(file.size)} ·{" "}
            {file.source === "paste" ? "pasted" : "edited"}{" "}
            {formatDate(file.lastModified)}
          </p>
        </div>
        <Button
          aria-label="Clear current tab"
          onClick={onReset}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
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
    <div className="rounded-md border bg-background/70 p-2.5">
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
    <div className="flex min-h-0 flex-1 flex-col p-3 text-card-foreground">
      <div className="flex items-center gap-2 px-1 pb-1">
        <ListTree className="size-4 text-[#03444A] dark:text-[#58D1E2]" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Outline
        </h2>
      </div>
      {headings.length > 0 ? (
        <nav className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto pr-1">
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
  onChooseFile,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onPaste,
  onPasteMarkdown,
}: {
  isDragging: boolean;
  onChooseFile: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onPasteMarkdown: () => void;
}) {
  return (
    <UploadDropZone
      isDragging={isDragging}
      onChooseFile={onChooseFile}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPaste={onPaste}
      onPasteMarkdown={onPasteMarkdown}
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

function createDocumentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `document-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createReaderTab(): ReaderTab {
  return {
    activeHeadingId: null,
    error: null,
    file: null,
    id: createDocumentId(),
    view: "preview",
  };
}

function getReaderTabLabel(tab: ReaderTab, index: number) {
  return tab.file?.name ?? `New tab${index > 0 ? ` ${index + 1}` : ""}`;
}

function isEditablePasteTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function getPastedDocumentName(content: string) {
  const heading = content.match(/^#{1,6}\s+(.+?)\s*#*\s*$/m)?.[1];
  const baseName = heading
    ? toPlainSpeechText(heading).replace(/[/:*?"<>|]/g, "").trim()
    : "Pasted markdown";

  return `${baseName.slice(0, 48) || "Pasted markdown"}.md`;
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
