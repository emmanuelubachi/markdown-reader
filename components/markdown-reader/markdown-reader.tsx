"use client";

import {
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Braces,
  ClipboardPaste,
  Columns2,
  FileText,
  PanelRightClose,
  Search,
  Upload,
} from "lucide-react";

import { FileSummary } from "@/components/markdown-reader/file-summary";
import { MarkdownPreview } from "@/components/markdown-reader/markdown-preview";
import { Outline } from "@/components/markdown-reader/outline";
import { PasteMarkdownDialog } from "@/components/markdown-reader/paste-dialog";
import { ReadAloudToolbar } from "@/components/markdown-reader/read-aloud-toolbar";
import { ReaderTabs } from "@/components/markdown-reader/reader-tabs";
import { EmptyPreview } from "@/components/markdown-reader/upload-drop-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/markdown/constants";
import {
  createReaderTab,
  getPastedDocumentName,
  getReaderTabLabel,
  isEditablePasteTarget,
  isMarkdownFile,
} from "@/lib/markdown/document";
import { parseMarkdown } from "@/lib/markdown/parse";
import { getReadableChunks } from "@/lib/markdown/speech";
import { getDocumentStats } from "@/lib/markdown/stats";
import type {
  DocumentStats,
  HeadingBlock,
  LoadedFile,
  MarkdownBlock,
  ReaderState,
  ReaderTab,
} from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

type ReaderTabModel = {
  blocks: MarkdownBlock[];
  headings: HeadingBlock[];
  outlineActiveHeadingId: null | string;
  readAloudChunks: string[];
  stats: DocumentStats;
};

export function MarkdownReader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
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
  const documentView = activeTab.view;
  const [splitTabId, setSplitTabId] = useState<null | string>(null);
  const splitTab = useMemo(() => {
    if (!splitTabId) {
      return null;
    }

    return (
      readerState.tabs.find(
        (tab) => tab.id === splitTabId && tab.id !== activeTab.id,
      ) ??
      readerState.tabs.find((tab) => tab.id !== activeTab.id) ??
      null
    );
  }, [activeTab.id, readerState.tabs, splitTabId]);
  const activeModel = useReaderTabModel(activeTab);
  const splitModel = useReaderTabModel(splitTab);

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
      return false;
    }

    const size = new Blob([content]).size;

    if (size > MAX_FILE_SIZE) {
      updateTab(tabId, {
        error:
          "The pasted markdown is larger than 5 MB. Try a smaller selection.",
      });
      return false;
    }

    loadTabContent(tabId, {
      content,
      lastModified: Date.now(),
      name: getPastedDocumentName(content),
      size,
      source: "paste",
    });

    return true;
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

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
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

  function toggleSplitView() {
    if (splitTab) {
      setSplitTabId(null);
      return;
    }

    setSplitTabId(
      readerState.tabs.find((tab) => tab.id !== activeTab.id)?.id ?? null,
    );
  }

  function selectTab(tabId: string) {
    setReaderState((currentState) => ({
      ...currentState,
      activeTabId: tabId,
    }));
  }

  function closeTab(tabId: string) {
    setSplitTabId((currentSplitTabId) =>
      currentSplitTabId === tabId ? null : currentSplitTabId,
    );

    setReaderState((currentState) => {
      const closedIndex = currentState.tabs.findIndex(
        (tab) => tab.id === tabId,
      );

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
        <div className="shrink-0 border-b border-border/70 bg-muted/40 backdrop-blur supports-backdrop-filter:bg-muted/30">
          <ReaderTabs
            activeTabId={readerState.activeTabId}
            onCloseTab={closeTab}
            onNewTab={createNewTab}
            onSelectTab={selectTab}
            tabs={readerState.tabs}
          />

          <div className="flex items-center gap-2 px-2.5 py-2 sm:px-3">
            <div className="hidden items-center mr-1.5 sm:flex">
              {/* Brand mark: dark-colored variant in light mode, teal in dark mode. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Markdown Reader"
                className="size-6 object-contain dark:hidden"
                src="/assets/logo-mark-dark.svg"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                aria-hidden="true"
                className="hidden size-6 object-contain dark:block"
                src="/assets/logo-mark.svg"
              />
            </div>

            {/* Address bar */}
            <div
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 shadow-xs ring-1 ring-foreground/5",
                file ? "max-w-[16rem] shrink lg:max-w-xs" : "flex-1",
              )}
            >
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
              {file ? (
                <Badge
                  variant="outline"
                  className="hidden shrink-0 border-[#8EA8AC]/45 text-[#03444A] xl:inline-flex dark:text-[#58D1E2]"
                >
                  Local
                </Badge>
              ) : (
                <span className="ml-auto hidden shrink-0 truncate text-xs text-muted-foreground md:inline">
                  Choose, drop, or paste markdown to start
                </span>
              )}
            </div>

            {file ? (
              <ReadAloudToolbar
                chunks={activeModel.readAloudChunks}
                className="hidden min-w-0 flex-1 sm:flex"
                key={`${activeTab.id}-${file.name}-${file.lastModified}-${file.size}`}
              />
            ) : null}

            <Button
              aria-label={splitTab ? "Close split view" : "Open split view"}
              aria-pressed={Boolean(splitTab)}
              className="hidden shrink-0 lg:inline-flex"
              disabled={readerState.tabs.length < 2}
              onClick={toggleSplitView}
              size="icon"
              type="button"
              variant={splitTab ? "secondary" : "outline"}
            >
              {splitTab ? (
                <PanelRightClose aria-hidden="true" />
              ) : (
                <Columns2 aria-hidden="true" />
              )}
            </Button>

            <TabsList
              aria-label="Document view"
              className={cn("shrink-0", splitTab && "lg:hidden")}
            >
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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {splitTab ? (
            <>
              <SplitReaderView
                activeTabId={activeTab.id}
                className="hidden lg:flex"
                onCloseSplit={() => setSplitTabId(null)}
                onSelectSplitTab={setSplitTabId}
                primaryModel={activeModel}
                primaryTab={activeTab}
                secondaryModel={splitModel}
                secondaryTab={splitTab}
                tabs={readerState.tabs}
                updateTab={updateTab}
              />
              <SingleReaderView
                activeModel={activeModel}
                activeTab={activeTab}
                className="flex lg:hidden"
                handleDragEnter={handleDragEnter}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handlePaste={handlePaste}
                isDragging={isDragging}
                onChooseFile={openFilePicker}
                onOpenPaste={() => setIsPasteDialogOpen(true)}
                onReset={resetReader}
                updateTab={updateTab}
              />
            </>
          ) : (
            <SingleReaderView
              activeModel={activeModel}
              activeTab={activeTab}
              className="flex"
              handleDragEnter={handleDragEnter}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handlePaste={handlePaste}
              isDragging={isDragging}
              onChooseFile={openFilePicker}
              onOpenPaste={() => setIsPasteDialogOpen(true)}
              onReset={resetReader}
              updateTab={updateTab}
            />
          )}
        </div>
      </Tabs>

      <PasteMarkdownDialog
        onImport={(text) => loadMarkdownText(text, activeTab.id)}
        onOpenChange={setIsPasteDialogOpen}
        open={isPasteDialogOpen}
      />
    </main>
  );
}

function useReaderTabModel(tab: ReaderTab | null): ReaderTabModel {
  const content = tab?.file?.content ?? "";
  const activeHeadingId = tab?.activeHeadingId ?? null;
  const blocks = useMemo(() => parseMarkdown(content), [content]);
  const stats = useMemo(() => getDocumentStats(content), [content]);
  const headings = useMemo(
    () => blocks.filter((block) => block.type === "heading"),
    [blocks],
  );
  const readAloudChunks = useMemo(() => getReadableChunks(blocks), [blocks]);
  const outlineActiveHeadingId = useMemo(() => {
    if (
      activeHeadingId &&
      headings.some((heading) => heading.id === activeHeadingId)
    ) {
      return activeHeadingId;
    }

    return headings[0]?.id ?? null;
  }, [activeHeadingId, headings]);

  return {
    blocks,
    headings,
    outlineActiveHeadingId,
    readAloudChunks,
    stats,
  };
}

function SingleReaderView({
  activeModel,
  activeTab,
  className,
  handleDragEnter,
  handleDragLeave,
  handleDrop,
  handlePaste,
  isDragging,
  onChooseFile,
  onOpenPaste,
  onReset,
  updateTab,
}: {
  activeModel: ReaderTabModel;
  activeTab: ReaderTab;
  className?: string;
  handleDragEnter: (event: DragEvent<HTMLElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => void;
  handlePaste: (event: ClipboardEvent<HTMLElement>) => void;
  isDragging: boolean;
  onChooseFile: () => void;
  onOpenPaste: () => void;
  onReset: () => void;
  updateTab: (tabId: string, updates: Partial<ReaderTab>) => void;
}) {
  const file = activeTab.file;

  return (
    <div className={cn("min-h-0 flex-1 overflow-hidden", className)}>
      {file ? (
        <aside className="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 lg:flex xl:w-80">
          <div className="space-y-3 border-b border-border/70 p-3">
            {activeTab.error ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>File not loaded</AlertTitle>
                <AlertDescription>{activeTab.error}</AlertDescription>
              </Alert>
            ) : null}

            <FileSummary
              file={file}
              onReset={onReset}
              stats={activeModel.stats}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="justify-center"
                onClick={onChooseFile}
                size="sm"
                type="button"
                variant="outline"
              >
                <Upload aria-hidden="true" />
                Open
              </Button>
              <Button
                className="justify-center"
                onClick={onOpenPaste}
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
            activeHeadingId={activeModel.outlineActiveHeadingId}
            headings={activeModel.headings}
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
                  blocks={activeModel.blocks}
                  onActiveHeadingChange={(headingId) =>
                    updateTab(activeTab.id, { activeHeadingId: headingId })
                  }
                />
              ) : (
                <div className="flex w-full max-w-md flex-col gap-4">
                  {activeTab.error ? (
                    <Alert variant="destructive">
                      <AlertCircle aria-hidden="true" />
                      <AlertTitle>File not loaded</AlertTitle>
                      <AlertDescription>{activeTab.error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <EmptyPreview
                    isDragging={isDragging}
                    onChooseFile={onChooseFile}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    onPaste={handlePaste}
                    onPasteMarkdown={onOpenPaste}
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
            <SourceView content={file.content} />
          </TabsContent>
        ) : null}
      </section>
    </div>
  );
}

function SplitReaderView({
  activeTabId,
  className,
  onCloseSplit,
  onSelectSplitTab,
  primaryModel,
  primaryTab,
  secondaryModel,
  secondaryTab,
  tabs,
  updateTab,
}: {
  activeTabId: string;
  className?: string;
  onCloseSplit: () => void;
  onSelectSplitTab: (tabId: string) => void;
  primaryModel: ReaderTabModel;
  primaryTab: ReaderTab;
  secondaryModel: ReaderTabModel;
  secondaryTab: ReaderTab;
  tabs: ReaderTab[];
  updateTab: (tabId: string, updates: Partial<ReaderTab>) => void;
}) {
  return (
    <ResizablePanelGroup
      className={cn("min-h-0 flex-1", className)}
      orientation="horizontal"
    >
      <ResizablePanel defaultSize={50} minSize={35}>
        <SplitReaderPane
          label="Active tab"
          model={primaryModel}
          tab={primaryTab}
          updateTab={updateTab}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={35}>
        <SplitReaderPane
          activeTabId={activeTabId}
          label="Second tab"
          model={secondaryModel}
          onCloseSplit={onCloseSplit}
          onSelectTab={onSelectSplitTab}
          selectableTabs={tabs}
          tab={secondaryTab}
          updateTab={updateTab}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function SplitReaderPane({
  activeTabId,
  label,
  model,
  onCloseSplit,
  onSelectTab,
  selectableTabs,
  tab,
  updateTab,
}: {
  activeTabId?: string;
  label: string;
  model: ReaderTabModel;
  onCloseSplit?: () => void;
  onSelectTab?: (tabId: string) => void;
  selectableTabs?: ReaderTab[];
  tab: ReaderTab;
  updateTab: (tabId: string, updates: Partial<ReaderTab>) => void;
}) {
  const file = tab.file;

  return (
    <Tabs
      className="flex h-full min-h-0 flex-col bg-card text-card-foreground"
      onValueChange={(value) =>
        updateTab(tab.id, {
          view: value === "source" && file ? "source" : "preview",
        })
      }
      value={tab.view}
    >
      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {selectableTabs && onSelectTab ? (
            <NativeSelect
              aria-label="Choose split tab"
              className="mt-1 w-full max-w-xs"
              onChange={(event) => onSelectTab(event.currentTarget.value)}
              size="sm"
              value={tab.id}
            >
              {selectableTabs
                .filter((candidateTab) => candidateTab.id !== activeTabId)
                .map((candidateTab, index) => (
                  <NativeSelectOption
                    key={candidateTab.id}
                    value={candidateTab.id}
                  >
                    {getReaderTabLabel(candidateTab, index)}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          ) : (
            <p className="truncate text-sm font-medium">
              {file?.name ?? getReaderTabLabel(tab, 0)}
            </p>
          )}
        </div>

        {file ? (
          <TabsList aria-label={`${label} view`} className="shrink-0">
            <TabsTrigger value="preview">
              <BookOpen aria-hidden="true" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source">
              <Braces aria-hidden="true" />
              Source
            </TabsTrigger>
          </TabsList>
        ) : null}

        {onCloseSplit ? (
          <Button
            aria-label="Close split view"
            onClick={onCloseSplit}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelRightClose aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {tab.error ? (
        <div className="shrink-0 border-b border-border/70 p-3">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>File not loaded</AlertTitle>
            <AlertDescription>{tab.error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <TabsContent
        value="preview"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <ScrollArea className="h-full">
          <div
            className={cn(
              file
                ? "mx-auto w-full max-w-3xl px-5 py-8"
                : "flex min-h-full w-full items-center justify-center p-6",
            )}
          >
            {file ? (
              <MarkdownPreview
                blocks={model.blocks}
                onActiveHeadingChange={(headingId) =>
                  updateTab(tab.id, { activeHeadingId: headingId })
                }
              />
            ) : (
              <div className="max-w-sm rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No document in this tab</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select the tab from the tab strip to open or paste markdown.
                </p>
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
          <SourceView content={file.content} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function SourceView({ content }: { content: string }) {
  return (
    <ScrollArea className="h-full">
      <pre
        className="min-h-full overflow-x-auto bg-muted/30 p-5 font-mono text-xs leading-relaxed text-foreground sm:p-8"
        data-readable-root="source"
      >
        {content}
      </pre>
    </ScrollArea>
  );
}
