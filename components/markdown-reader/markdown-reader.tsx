"use client";

import {
  useCallback,
  useEffect,
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
  ChevronDown,
  ClipboardPaste,
  Columns2,
  Download,
  FileText,
  PanelRightClose,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  MAX_OPEN_FILES,
} from "@/lib/markdown/constants";
import {
  createLoadedReaderTab,
  createReaderTab,
  getDownloadFileName,
  getPastedDocumentName,
  getReaderTabLabel,
  isEditablePasteTarget,
  isMarkdownFile,
  placeLoadedFileInReaderState,
} from "@/lib/markdown/document";
import { parseMarkdown } from "@/lib/markdown/parse";
import {
  clearReaderSession as clearReaderSessionStorage,
  isReaderPersistenceAvailable,
  loadReaderSession,
  rememberActiveReaderTabId,
  saveReaderSession,
} from "@/lib/markdown/persistence";
import {
  getReadableSpeech,
  rememberReadableSelection,
  type SpeechSection,
} from "@/lib/markdown/speech";
import { getDocumentStats } from "@/lib/markdown/stats";
import {
  useReadAloud,
  type ReadAloudController,
} from "@/hooks/use-read-aloud";
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
  readAloudChunkLines: number[];
  readAloudSections: SpeechSection[];
  stats: DocumentStats;
};

type PersistenceStatus =
  | "error"
  | "restoring"
  | "saved"
  | "saving"
  | "unavailable";

const SAVE_INDICATOR_TIMEOUT_MS = 2500;

export function MarkdownReader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const didChangeBeforeRestoreRef = useRef(false);
  const persistenceAvailableRef = useRef(false);
  const readerStateRef = useRef<ReaderState | null>(null);
  const lastPersistedSignatureRef = useRef<null | string>(null);
  const saveIndicatorTimeoutRef = useRef<null | number>(null);
  const saveSequenceRef = useRef(0);
  // Nesting-safe drag counter: dragenter/dragleave fire for every child the
  // pointer crosses, so we track depth and only clear the overlay at zero.
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<PersistenceStatus>("restoring");
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
  const canUseSplitView = readerState.tabs.length >= 2;
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
  // Lifted here (instead of inside the toolbar) so playback survives tab
  // switches — MarkdownReader stays mounted while the toolbar remounts per tab.
  const reader = useReadAloud();

  const clearSaveIndicatorTimeout = useCallback(() => {
    if (saveIndicatorTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(saveIndicatorTimeoutRef.current);
    saveIndicatorTimeoutRef.current = null;
  }, []);

  const showSavingIndicator = useCallback(
    (saveSequence: number) => {
      clearSaveIndicatorTimeout();
      setPersistenceStatus("saving");

      saveIndicatorTimeoutRef.current = window.setTimeout(() => {
        if (saveSequenceRef.current === saveSequence) {
          setPersistenceStatus("saved");
        }
      }, SAVE_INDICATOR_TIMEOUT_MS);
    },
    [clearSaveIndicatorTimeout],
  );

  useEffect(() => {
    readerStateRef.current = readerState;
  }, [readerState]);

  useEffect(
    () => () => clearSaveIndicatorTimeout(),
    [clearSaveIndicatorTimeout],
  );

  // Persist-worthy fingerprint of the session. Excludes transient UI state
  // (e.g. the scroll-driven active heading) so scrolling never triggers a save.
  const persistenceSignature = useMemo(
    () => getReaderPersistenceSignature(readerState),
    [readerState],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!isReaderPersistenceAvailable()) {
      persistenceAvailableRef.current = false;
      const unavailableStatusId = window.setTimeout(() => {
        if (!isCancelled) {
          setPersistenceStatus("unavailable");
          setIsPersistenceReady(true);
        }
      }, 0);

      return () => window.clearTimeout(unavailableStatusId);
    }

    persistenceAvailableRef.current = true;
    void loadReaderSession()
      .then((session) => {
        if (isCancelled) {
          return;
        }

        if (session && !didChangeBeforeRestoreRef.current) {
          readerStateRef.current = session.state;
          lastPersistedSignatureRef.current = getReaderPersistenceSignature(
            session.state,
          );
          setReaderState(session.state);
          setPersistenceStatus("saved");
        } else {
          setPersistenceStatus("saving");
        }

        setIsPersistenceReady(true);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setPersistenceStatus("error");
        setIsPersistenceReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPersistenceReady || !persistenceAvailableRef.current) {
      return;
    }

    // Already persisted this exact state (e.g. via an immediate save on a
    // structural change) — no debounced write needed.
    if (persistenceSignature === lastPersistedSignatureRef.current) {
      return;
    }

    const saveSequence = saveSequenceRef.current + 1;

    saveSequenceRef.current = saveSequence;
    const statusTimeoutId = window.setTimeout(
      () => showSavingIndicator(saveSequence),
      0,
    );

    const timeoutId = window.setTimeout(() => {
      const stateToSave = readerStateRef.current;

      if (!stateToSave) {
        return;
      }

      void saveReaderSession(stateToSave)
        .then((savedAt) => {
          if (saveSequenceRef.current !== saveSequence) {
            return;
          }

          if (savedAt) {
            lastPersistedSignatureRef.current = persistenceSignature;
            clearSaveIndicatorTimeout();
            setPersistenceStatus("saved");
          } else {
            clearSaveIndicatorTimeout();
            setPersistenceStatus("unavailable");
          }
        })
        .catch(() => {
          if (saveSequenceRef.current === saveSequence) {
            clearSaveIndicatorTimeout();
            setPersistenceStatus("error");
          }
        });
    }, 450);

    return () => {
      window.clearTimeout(statusTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [
    clearSaveIndicatorTimeout,
    isPersistenceReady,
    persistenceSignature,
    showSavingIndicator,
  ]);

  function markReaderStateChanged() {
    didChangeBeforeRestoreRef.current = true;
  }

  function getCurrentReaderState() {
    return readerStateRef.current ?? readerState;
  }

  function persistReaderStateImmediately(nextState: ReaderState) {
    rememberActiveReaderTabId(nextState.activeTabId);

    if (!persistenceAvailableRef.current) {
      return;
    }

    // Mark this state as persisted up front so the debounced autosave effect
    // (which re-runs on the same signature change) skips a redundant write.
    const signature = getReaderPersistenceSignature(nextState);

    lastPersistedSignatureRef.current = signature;

    const saveSequence = saveSequenceRef.current + 1;

    saveSequenceRef.current = saveSequence;
    showSavingIndicator(saveSequence);

    void saveReaderSession(nextState)
      .then((savedAt) => {
        if (saveSequenceRef.current !== saveSequence) {
          return;
        }

        if (savedAt) {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("saved");
        } else {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("unavailable");
        }
      })
      .catch(() => {
        // Let the debounced autosave retry this state on the next change.
        if (lastPersistedSignatureRef.current === signature) {
          lastPersistedSignatureRef.current = null;
        }

        if (saveSequenceRef.current === saveSequence) {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("error");
        }
      });
  }

  function commitReaderState(
    nextState: ReaderState,
    options: { persistImmediately?: boolean } = {},
  ) {
    markReaderStateChanged();
    readerStateRef.current = nextState;
    setReaderState(nextState);
    rememberActiveReaderTabId(nextState.activeTabId);

    if (options.persistImmediately) {
      persistReaderStateImmediately(nextState);
    }
  }

  function updateTab(
    tabId: string,
    updates: Partial<ReaderTab>,
    options: { persistImmediately?: boolean } = {},
  ) {
    const currentState = getCurrentReaderState();

    if (!currentState.tabs.some((tab) => tab.id === tabId)) {
      return;
    }

    commitReaderState(
      {
        ...currentState,
        tabs: currentState.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updates } : tab,
        ),
      },
      options,
    );
  }

  function editTabContent(tabId: string, content: string) {
    if (reader.sourceTabId === tabId) {
      reader.stop();
    }

    const size = new Blob([content]).size;
    const currentState = getCurrentReaderState();

    commitReaderState({
      ...currentState,
      tabs: currentState.tabs.map((tab) => {
        if (tab.id !== tabId || !tab.file) {
          return tab;
        }

        return {
          ...tab,
          activeHeadingId: null,
          error: null,
          file: {
            ...tab.file,
            content,
            lastModified: Date.now(),
            size,
          },
        };
      }),
    });
  }

  function clearFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function notifySkipped(counts: {
    nonMarkdown: number;
    overCap: number;
    tooLarge: number;
    unreadable: number;
  }) {
    const skipped =
      counts.nonMarkdown + counts.tooLarge + counts.unreadable + counts.overCap;

    if (skipped === 0) {
      return;
    }

    const description = [
      counts.nonMarkdown > 0 && `${counts.nonMarkdown} not markdown`,
      counts.tooLarge > 0 && `${counts.tooLarge} over 5 MB`,
      counts.unreadable > 0 && `${counts.unreadable} unreadable`,
      counts.overCap > 0 &&
        `${counts.overCap} over the ${MAX_OPEN_FILES}-file limit`,
    ]
      .filter(Boolean)
      .join(" · ");

    toast.warning(`Skipped ${skipped} file${skipped === 1 ? "" : "s"}`, {
      description,
    });
  }

  // Open one or more markdown files, each in its own tab. Reads and validates
  // them in parallel, then commits every new tab in a single state update (one
  // persistence write). The first file reuses the active tab when it's empty.
  async function openFiles(fileList: File[]) {
    if (fileList.length === 0) {
      return;
    }

    const markdownFiles = fileList.filter(isMarkdownFile);
    const nonMarkdown = fileList.length - markdownFiles.length;
    const overCap = Math.max(0, markdownFiles.length - MAX_OPEN_FILES);
    const candidates = markdownFiles.slice(0, MAX_OPEN_FILES);
    const isSingleSelection = fileList.length === 1;

    if (candidates.length === 0) {
      // A lone non-markdown file keeps the original per-tab error; a mixed
      // batch of junk just reports and leaves the current document alone.
      if (isSingleSelection) {
        updateTab(activeTab.id, {
          error: "Choose a markdown file with a .md or .markdown extension.",
        });
      } else {
        notifySkipped({ nonMarkdown, overCap, tooLarge: 0, unreadable: 0 });
      }

      clearFileInput();
      return;
    }

    // Promise.all preserves input order, so tab order matches selection order.
    const results = await Promise.all(
      candidates.map(async (file) => {
        if (file.size > MAX_FILE_SIZE) {
          return { status: "too-large" as const };
        }

        try {
          const content = await file.text();

          return {
            loaded: {
              content,
              lastModified: file.lastModified,
              name: file.name,
              size: file.size,
              source: "file",
            } satisfies LoadedFile,
            status: "ok" as const,
          };
        } catch {
          return { status: "unreadable" as const };
        }
      }),
    );

    const loaded = results.flatMap((result) =>
      result.status === "ok" ? [result.loaded] : [],
    );
    const tooLarge = results.filter((r) => r.status === "too-large").length;
    const unreadable = results.filter((r) => r.status === "unreadable").length;

    if (loaded.length === 0) {
      if (isSingleSelection) {
        updateTab(activeTab.id, {
          error: tooLarge
            ? "This file is larger than 5 MB. Try a smaller markdown file."
            : "The file could not be read. Try exporting it again.",
        });
      } else {
        notifySkipped({ nonMarkdown, overCap, tooLarge, unreadable });
      }

      clearFileInput();
      return;
    }

    // Read state AFTER the await so a tab switch during the read still targets
    // the tab the user is actually on.
    const currentState = getCurrentReaderState();
    const activeIsEmpty =
      currentState.tabs.find((tab) => tab.id === currentState.activeTabId)
        ?.file == null;

    let tabs: ReaderTab[];
    let firstOpenedId: string;

    if (activeIsEmpty) {
      const [firstFile, ...restFiles] = loaded;

      firstOpenedId = currentState.activeTabId;
      tabs = [
        ...currentState.tabs.map((tab) =>
          tab.id === currentState.activeTabId
            ? {
                ...tab,
                activeHeadingId: null,
                error: null,
                file: firstFile,
                view: "preview" as const,
              }
            : tab,
        ),
        ...restFiles.map(createLoadedReaderTab),
      ];
    } else {
      const newTabs = loaded.map(createLoadedReaderTab);

      firstOpenedId = newTabs[0]!.id;
      tabs = [...currentState.tabs, ...newTabs];
    }

    commitReaderState(
      { activeTabId: firstOpenedId, tabs },
      { persistImmediately: true },
    );

    clearFileInput();
    notifySkipped({ nonMarkdown, overCap, tooLarge, unreadable });
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

    const nextFile: LoadedFile = {
      content,
      lastModified: Date.now(),
      name: getPastedDocumentName(content),
      size,
      source: "paste",
    };
    const nextState = placeLoadedFileInReaderState(
      getCurrentReaderState(),
      nextFile,
      tabId,
    );

    commitReaderState(nextState, { persistImmediately: true });

    return true;
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function dragHasFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  // Save the active document (including any source edits) to the user's device
  // as a .md file — a client-side Blob download, nothing leaves the browser.
  function downloadDocument() {
    if (!file) {
      return;
    }

    const blob = new Blob([file.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.download = getDownloadFileName(file.name);
    anchor.href = url;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!dragHasFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!dragHasFiles(event)) {
      return;
    }

    // Required for the drop to fire at all.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!dragHasFiles(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    if (!dragHasFiles(event)) {
      return;
    }

    void openFiles(Array.from(event.dataTransfer.files));
  }

  function resetReader() {
    if (reader.sourceTabId === activeTab.id) {
      reader.stop();
    }

    updateTab(
      activeTab.id,
      {
        activeHeadingId: null,
        error: null,
        file: null,
        view: "preview",
      },
      { persistImmediately: true },
    );
  }

  function createNewTab() {
    const currentState = getCurrentReaderState();
    const nextTab = createReaderTab();

    commitReaderState(
      {
        activeTabId: nextTab.id,
        tabs: [...currentState.tabs, nextTab],
      },
      { persistImmediately: true },
    );
  }

  async function handleClearReaderSession() {
    reader.stop();
    setSplitTabId(null);

    const freshTab = createReaderTab();
    const nextState: ReaderState = {
      activeTabId: freshTab.id,
      tabs: [freshTab],
    };

    // Reset in memory and mark the blank session as already persisted so the
    // autosave effect doesn't immediately re-write it after we wipe storage.
    didChangeBeforeRestoreRef.current = true;
    readerStateRef.current = nextState;
    lastPersistedSignatureRef.current =
      getReaderPersistenceSignature(nextState);
    setReaderState(nextState);
    rememberActiveReaderTabId(nextState.activeTabId);

    try {
      await clearReaderSessionStorage();
      setPersistenceStatus(
        persistenceAvailableRef.current ? "saved" : "unavailable",
      );
    } catch {
      setPersistenceStatus("error");
    }
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
    const currentState = getCurrentReaderState();

    if (!currentState.tabs.some((tab) => tab.id === tabId)) {
      return;
    }

    commitReaderState(
      {
        ...currentState,
        activeTabId: tabId,
      },
      { persistImmediately: true },
    );
  }

  function closeTab(tabId: string) {
    // Closing the document that is being read should stop its playback.
    if (reader.sourceTabId === tabId) {
      reader.stop();
    }

    setSplitTabId((currentSplitTabId) =>
      currentSplitTabId === tabId ? null : currentSplitTabId,
    );

    const currentState = getCurrentReaderState();
    const closedIndex = currentState.tabs.findIndex((tab) => tab.id === tabId);

    if (closedIndex === -1) {
      return;
    }

    const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);

    if (nextTabs.length === 0) {
      const nextTab = createReaderTab();

      commitReaderState(
        {
          activeTabId: nextTab.id,
          tabs: [nextTab],
        },
        { persistImmediately: true },
      );
      return;
    }

    const activeTabStillExists = nextTabs.some(
      (tab) => tab.id === currentState.activeTabId,
    );
    const fallbackTab =
      nextTabs[Math.min(Math.max(closedIndex, 0), nextTabs.length - 1)] ??
      nextTabs[0]!;

    commitReaderState(
      {
        activeTabId:
          tabId === currentState.activeTabId || !activeTabStillExists
            ? fallbackTab.id
            : currentState.activeTabId,
        tabs: nextTabs,
      },
      { persistImmediately: true },
    );
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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {isDragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#58D1E2] bg-[#58D1E2]/12 px-10 py-8 text-center text-[#03444A] shadow-lg dark:text-[#58D1E2]">
            <Upload className="size-8" aria-hidden="true" />
            <p className="text-base font-semibold">
              Drop markdown files to open
            </p>
            <p className="text-sm text-muted-foreground">
              Each file opens in its own tab
            </p>
          </div>
        </div>
      ) : null}

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
            onClearSession={handleClearReaderSession}
            onCloseTab={closeTab}
            onNewTab={createNewTab}
            onSelectTab={selectTab}
            persistenceStatus={persistenceStatus}
            tabs={readerState.tabs}
          />

          <div className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3">
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
                activeTabId={activeTab.id}
                chunks={activeModel.readAloudChunks}
                className="hidden min-w-0 flex-1 sm:flex"
                onSelectSourceTab={selectTab}
                reader={reader}
                sections={activeModel.readAloudSections}
              />
            ) : null}

            {canUseSplitView ? (
              <Button
                aria-label={splitTab ? "Close split view" : "Open split view"}
                aria-pressed={Boolean(splitTab)}
                className="hidden shrink-0 lg:inline-flex"
                onClick={toggleSplitView}
                size="icon"
                type="button"
                variant="secondary"
              >
                {splitTab ? (
                  <PanelRightClose aria-hidden="true" />
                ) : (
                  <Columns2 aria-hidden="true" />
                )}
              </Button>
            ) : null}

            {file ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  aria-label="Open a Markdown file"
                  onClick={openFilePicker}
                  size="icon"
                  title="Open file"
                  type="button"
                  variant="secondary"
                >
                  <Upload aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Paste Markdown"
                  onClick={() => setIsPasteDialogOpen(true)}
                  size="icon"
                  title="Paste markdown"
                  type="button"
                  variant="secondary"
                >
                  <ClipboardPaste aria-hidden="true" />
                </Button>
                <Button
                  aria-label="Download this Markdown file"
                  onClick={downloadDocument}
                  size="icon"
                  title="Download .md"
                  type="button"
                  variant="secondary"
                >
                  <Download aria-hidden="true" />
                </Button>
              </div>
            ) : null}

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

          {file ? (
            <ReadAloudToolbar
              activeTabId={activeTab.id}
              chunks={activeModel.readAloudChunks}
              className="flex min-w-0 rounded-none border-x-0 border-b-0 px-2 sm:hidden"
              controlIdPrefix="mobile-read-aloud"
              onSelectSourceTab={selectTab}
              reader={reader}
              sections={activeModel.readAloudSections}
            />
          ) : null}
        </div>

        <input
          ref={inputRef}
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          multiple
          onChange={(event) => {
            const files = event.currentTarget.files;

            if (files && files.length > 0) {
              void openFiles(Array.from(files));
            }
          }}
          type="file"
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {splitTab ? (
            <>
              <SplitReaderView
                activeTabId={activeTab.id}
                className="hidden lg:flex"
                onSelectSplitTab={setSplitTabId}
                onSourceChange={editTabContent}
                primaryTab={activeTab}
                reader={reader}
                secondaryTab={splitTab}
                tabs={readerState.tabs}
                updateTab={updateTab}
              />
              <SingleReaderView
                activeModel={activeModel}
                activeTab={activeTab}
                className="flex lg:hidden"
                handlePaste={handlePaste}
                isDragging={isDragging}
                onChooseFile={openFilePicker}
                onOpenPaste={() => setIsPasteDialogOpen(true)}
                onReset={resetReader}
                onSourceChange={editTabContent}
                reader={reader}
                updateTab={updateTab}
              />
            </>
          ) : (
            <SingleReaderView
              activeModel={activeModel}
              activeTab={activeTab}
              className="flex"
              handlePaste={handlePaste}
              isDragging={isDragging}
              onChooseFile={openFilePicker}
              onOpenPaste={() => setIsPasteDialogOpen(true)}
              onReset={resetReader}
              onSourceChange={editTabContent}
              reader={reader}
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

// Cheap fingerprint of everything that must be persisted, excluding transient
// UI state such as `activeHeadingId`. File contents are represented by their
// metadata (name/size/lastModified/source) — editing content bumps
// `lastModified` and `size`, so real edits still change the signature without
// having to serialize the (potentially multi-MB) content on every render.
function getReaderPersistenceSignature(state: ReaderState) {
  const tabSignatures = state.tabs.map((tab) => {
    const file = tab.file;
    const fileSignature = file
      ? [file.name, file.size, file.lastModified, file.source].join("\u0000")
      : "";

    return [tab.id, tab.view, tab.error ?? "", fileSignature].join("\u0001");
  });

  return [state.activeTabId, ...tabSignatures].join("\u0002");
}

// The markdown source line of the passage currently being read aloud in `tab`,
// or null when this tab isn't the one that owns playback. Gated on sourceTabId +
// status (never the index value) so the index-0 reset doesn't false-highlight.
function getSpeakingLine(
  reader: ReadAloudController,
  tabId: string,
  chunkLines: number[],
): number | null {
  if (reader.sourceTabId !== tabId) {
    return null;
  }

  if (
    reader.status !== "playing" &&
    reader.status !== "paused" &&
    reader.status !== "loading"
  ) {
    return null;
  }

  return chunkLines[reader.currentIndex] ?? null;
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
  const {
    chunkLines: readAloudChunkLines,
    chunks: readAloudChunks,
    sections: readAloudSections,
  } = useMemo(() => getReadableSpeech(blocks), [blocks]);
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
    readAloudChunkLines,
    readAloudSections,
    stats,
  };
}

function SingleReaderView({
  activeModel,
  activeTab,
  className,
  handlePaste,
  isDragging,
  onChooseFile,
  onOpenPaste,
  onReset,
  onSourceChange,
  reader,
  updateTab,
}: {
  activeModel: ReaderTabModel;
  activeTab: ReaderTab;
  className?: string;
  handlePaste: (event: ClipboardEvent<HTMLElement>) => void;
  isDragging: boolean;
  onChooseFile: () => void;
  onOpenPaste: () => void;
  onReset: () => void;
  onSourceChange: (tabId: string, content: string) => void;
  reader: ReadAloudController;
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
                  activeSourceLine={getSpeakingLine(
                    reader,
                    activeTab.id,
                    activeModel.readAloudChunkLines,
                  )}
                  content={file.content}
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
            <SourceView
              content={file.content}
              onChange={(content) => onSourceChange(activeTab.id, content)}
            />
          </TabsContent>
        ) : null}
      </section>
    </div>
  );
}

function SplitReaderView({
  activeTabId,
  className,
  onSelectSplitTab,
  onSourceChange,
  primaryTab,
  reader,
  secondaryTab,
  tabs,
  updateTab,
}: {
  activeTabId: string;
  className?: string;
  onSelectSplitTab: (tabId: string) => void;
  onSourceChange: (tabId: string, content: string) => void;
  primaryTab: ReaderTab;
  reader: ReadAloudController;
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
          onSourceChange={onSourceChange}
          reader={reader}
          tab={primaryTab}
          updateTab={updateTab}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={35}>
        <SplitReaderPane
          activeTabId={activeTabId}
          label="Second tab"
          onSelectTab={onSelectSplitTab}
          onSourceChange={onSourceChange}
          reader={reader}
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
  onSelectTab,
  onSourceChange,
  reader,
  selectableTabs,
  tab,
  updateTab,
}: {
  activeTabId?: string;
  label: string;
  onSelectTab?: (tabId: string) => void;
  onSourceChange: (tabId: string, content: string) => void;
  reader: ReadAloudController;
  selectableTabs?: ReaderTab[];
  tab: ReaderTab;
  updateTab: (tabId: string, updates: Partial<ReaderTab>) => void;
}) {
  const file = tab.file;
  const model = useReaderTabModel(tab);

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
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-muted/30 px-2.5 sm:px-3">
        {/* File chip: static name for the active pane, switchable for the split pane */}
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 shadow-xs ring-1 ring-foreground/5">
          <FileText
            className="size-4 shrink-0 text-[#03444A] dark:text-[#58D1E2]"
            aria-hidden="true"
          />
          {selectableTabs && onSelectTab ? (
            <div className="relative flex min-w-0 flex-1 items-center">
              <select
                aria-label="Choose split tab"
                className="w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-5 text-sm font-medium outline-none"
                onChange={(event) => onSelectTab(event.currentTarget.value)}
                value={tab.id}
              >
                {selectableTabs
                  .filter((candidateTab) => candidateTab.id !== activeTabId)
                  .map((candidateTab, index) => (
                    <option
                      className="bg-[Canvas] font-sans text-[CanvasText]"
                      key={candidateTab.id}
                      value={candidateTab.id}
                    >
                      {getReaderTabLabel(candidateTab, index)}
                    </option>
                  ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-0 size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {file?.name ?? getReaderTabLabel(tab, 0)}
            </span>
          )}
        </div>

        {file ? (
          <TabsList aria-label={`${label} view`} className="shrink-0">
            <TabsTrigger value="preview">
              <BookOpen aria-hidden="true" />
              <span className="hidden xl:inline">Preview</span>
            </TabsTrigger>
            <TabsTrigger value="source">
              <Braces aria-hidden="true" />
              <span className="hidden xl:inline">Source</span>
            </TabsTrigger>
          </TabsList>
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
                activeSourceLine={getSpeakingLine(
                  reader,
                  tab.id,
                  model.readAloudChunkLines,
                )}
                content={file.content}
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
          <SourceView
            content={file.content}
            onChange={(content) => onSourceChange(tab.id, content)}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function SourceView({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) {
  return (
    <div className="h-full bg-muted/30">
      <textarea
        aria-label="Editable markdown source"
        className="h-full min-h-full w-full resize-none overflow-auto bg-transparent p-5 font-mono text-xs leading-relaxed text-foreground caret-[#03444A] outline-none selection:bg-[#58D1E2]/30 placeholder:text-muted-foreground dark:caret-[#58D1E2] sm:p-8"
        data-readable-root="source"
        onChange={(event) => onChange(event.currentTarget.value)}
        onSelect={(event) => {
          const textarea = event.currentTarget;

          rememberReadableSelection(
            textarea.value.slice(
              textarea.selectionStart,
              textarea.selectionEnd,
            ),
          );
        }}
        spellCheck={false}
        value={content}
      />
    </div>
  );
}
