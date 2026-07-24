"use client";

import { useCallback, useMemo, useState, type ClipboardEvent } from "react";
import {
  BookOpen,
  Braces,
  ClipboardPaste,
  Columns2,
  Download,
  PanelRightClose,
  Upload,
} from "lucide-react";

import { PasteMarkdownDialog } from "@/components/markdown-reader/paste-dialog";
import { ReadAloudToolbar } from "@/components/markdown-reader/read-aloud-toolbar";
import { ReaderTabs } from "@/components/markdown-reader/reader-tabs";
import {
  CopySourceButton,
  EditPreviewButton,
} from "@/components/markdown-reader/reader-view-controls";
import {
  SingleReaderView,
  SplitReaderView,
} from "@/components/markdown-reader/reader-views";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarkdownFiles } from "@/hooks/use-markdown-files";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { useReadAloudShortcuts } from "@/hooks/use-read-aloud-shortcuts";
import { useReaderSession } from "@/hooks/use-reader-session";
import { useReaderTabModel } from "@/hooks/use-reader-tab-model";
import { ACCEPTED_FILE_TYPES } from "@/lib/markdown/constants";
import {
  createReaderTab,
  isEditablePasteTarget,
} from "@/lib/markdown/document";
import { cn } from "@/lib/utils";

export function MarkdownReader() {
  const [isPasteDialogOpen, setIsPasteDialogOpen] = useState(false);
  const {
    clearReaderSession,
    commitReaderState,
    getCurrentReaderState,
    persistenceStatus,
    readerState,
    reorderTabs,
    updateTab,
  } = useReaderSession();

  const activeTab = useMemo(
    () =>
      readerState.tabs.find((tab) => tab.id === readerState.activeTabId) ??
      readerState.tabs[0]!,
    [readerState.activeTabId, readerState.tabs],
  );
  const {
    downloadDocument,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    inputRef,
    isDragging,
    loadMarkdownText,
    openFilePicker,
    openFiles,
  } = useMarkdownFiles({
    activeTab,
    commitReaderState,
    getCurrentReaderState,
    updateTab,
  });
  const file = activeTab.file;
  const documentView = activeTab.view;
  const canUseSplitView = readerState.tabs.length >= 2;
  const [splitTabId, setSplitTabId] = useState<null | string>(null);
  const [editingTabIds, setEditingTabIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const setTabEditing = useCallback((tabId: string, isEditing: boolean) => {
    setEditingTabIds((currentTabIds) => {
      if (currentTabIds.has(tabId) === isEditing) {
        return currentTabIds;
      }

      const nextTabIds = new Set(currentTabIds);

      if (isEditing) {
        nextTabIds.add(tabId);
      } else {
        nextTabIds.delete(tabId);
      }

      return nextTabIds;
    });
  }, []);
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

  useReadAloudShortcuts({
    activeTabId: activeTab.id,
    chunks: activeModel.readAloudChunks,
    reader,
  });

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

  function resetReader() {
    if (reader.sourceTabId === activeTab.id) {
      reader.stop();
    }

    setTabEditing(activeTab.id, false);

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
    setEditingTabIds(new Set());
    await clearReaderSession();
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
    setTabEditing(tabId, false);

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
        onValueChange={(value) => {
          if (value === "source") {
            setTabEditing(activeTab.id, false);
          }

          updateTab(activeTab.id, {
            view: value === "source" && file ? "source" : "preview",
          });
        }}
        value={documentView}
      >
        {/* Browser chrome: tab strip + document-only reader toolbar */}
        <div
          className={cn(
            "shrink-0 backdrop-blur supports-backdrop-filter:bg-muted dark:supports-backdrop-filter:bg-muted/70",
            file && "border-b border-border/50",
          )}
        >
          <ReaderTabs
            activeTabId={readerState.activeTabId}
            className={
              file ? undefined : "shadow-[inset_0_-1px_0_var(--border)]"
            }
            onClearSession={handleClearReaderSession}
            onCloseTab={closeTab}
            onNewTab={createNewTab}
            onReorderTab={reorderTabs}
            onSelectTab={selectTab}
            persistenceStatus={persistenceStatus}
            tabs={readerState.tabs}
          />

          {file ? (
            <div className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3">
              <ReadAloudToolbar
                activeTabId={activeTab.id}
                chunks={activeModel.readAloudChunks}
                className="hidden min-w-0 flex-1 sm:flex"
                onSelectSourceTab={selectTab}
                reader={reader}
                sections={activeModel.readAloudSections}
              />

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

              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5",
                  splitTab && "lg:hidden",
                )}
              >
                <TabsList aria-label="Document view" className="shrink-0">
                  <TabsTrigger aria-label="Preview" value="preview">
                    <BookOpen aria-hidden="true" />
                    <span className="hidden xl:inline">Preview</span>
                  </TabsTrigger>
                  <TabsTrigger aria-label="Source" value="source">
                    <Braces aria-hidden="true" />
                    <span className="hidden xl:inline">Source</span>
                  </TabsTrigger>
                </TabsList>

                {!splitTab ? (
                  documentView === "preview" ? (
                    <EditPreviewButton
                      isEditing={editingTabIds.has(activeTab.id)}
                      onEditingChange={(isEditing) =>
                        setTabEditing(activeTab.id, isEditing)
                      }
                    />
                  ) : (
                    <CopySourceButton content={file.content} />
                  )
                ) : null}
              </div>
            </div>
          ) : null}

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
                editingTabIds={editingTabIds}
                onEditingChange={setTabEditing}
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
                isEditing={false}
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
              isEditing={editingTabIds.has(activeTab.id)}
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
