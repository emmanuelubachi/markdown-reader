"use client";

import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import {
  MAX_FILE_SIZE,
  MAX_OPEN_FILES,
} from "@/lib/markdown/constants";
import {
  createLoadedReaderTab,
  getDownloadFileName,
  getPastedDocumentName,
  isMarkdownFile,
  placeLoadedFileInReaderState,
} from "@/lib/markdown/document";
import type {
  LoadedFile,
  ReaderState,
  ReaderTab,
} from "@/lib/markdown/types";

type CommitOptions = {
  persistImmediately?: boolean;
};

export function useMarkdownFiles({
  activeTab,
  commitReaderState,
  getCurrentReaderState,
  updateTab,
}: {
  activeTab: ReaderTab;
  commitReaderState: (
    nextState: ReaderState,
    options?: CommitOptions,
  ) => void;
  getCurrentReaderState: () => ReaderState;
  updateTab: (
    tabId: string,
    updates: Partial<ReaderTab>,
    options?: CommitOptions,
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  function clearFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

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

    // Read state after the async file reads so a concurrent tab switch is
    // respected instead of overwriting a stale snapshot.
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
      { ...currentState, activeTabId: firstOpenedId, tabs },
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

  function downloadDocument() {
    const file = activeTab.file;

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

    if (dragHasFiles(event)) {
      void openFiles(Array.from(event.dataTransfer.files));
    }
  }

  return {
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
  };
}

function dragHasFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
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
