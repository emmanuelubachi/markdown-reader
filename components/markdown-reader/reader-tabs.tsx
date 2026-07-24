"use client";

import {
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { AlertCircle, FileText, Plus, X } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { ReaderStorageMenu } from "@/components/markdown-reader/reader-storage-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveTabScroll } from "@/hooks/use-active-tab-scroll";
import type { ReaderPersistenceStatus } from "@/hooks/use-reader-session";
import { getReaderTabLabel } from "@/lib/markdown/document";
import type { ReaderTab } from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

type TabPlacement = "after" | "before";

type TabDropTarget = {
  placement: TabPlacement;
  tabId: string;
};

const READER_TAB_DRAG_TYPE = "application/x-markdown-reader-tab";

export function ReaderTabs({
  activeTabId,
  className,
  onClearSession,
  onCloseTab,
  onNewTab,
  onReorderTab,
  onSelectTab,
  persistenceStatus,
  tabs,
}: {
  activeTabId: string;
  className?: string;
  onClearSession: () => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onReorderTab: (
    movedTabId: string,
    targetTabId: string,
    placement: TabPlacement,
  ) => void;
  onSelectTab: (tabId: string) => void;
  persistenceStatus: ReaderPersistenceStatus;
  tabs: ReaderTab[];
}) {
  const { activeTabRef, tabListRef } = useActiveTabScroll(activeTabId, tabs);
  const [announcement, setAnnouncement] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TabDropTarget | null>(null);

  function resetDragState() {
    setDraggedTabId(null);
    setDropTarget(null);
  }

  function handleTabDragStart(
    event: DragEvent<HTMLButtonElement>,
    tabId: string,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(READER_TAB_DRAG_TYPE, tabId);
    setDraggedTabId(tabId);
    setDropTarget(null);
  }

  function handleTabDragOver(
    event: DragEvent<HTMLDivElement>,
    targetTabId: string,
  ) {
    const movedTabId =
      draggedTabId || event.dataTransfer.getData(READER_TAB_DRAG_TYPE);

    if (!movedTabId || movedTabId === targetTabId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const targetBounds = event.currentTarget.getBoundingClientRect();
    const placement: TabPlacement =
      event.clientX < targetBounds.left + targetBounds.width / 2
        ? "before"
        : "after";

    setDropTarget((currentTarget) =>
      currentTarget?.tabId === targetTabId &&
      currentTarget.placement === placement
        ? currentTarget
        : { placement, tabId: targetTabId },
    );
  }

  function handleTabDrop(
    event: DragEvent<HTMLDivElement>,
    targetTabId: string,
  ) {
    const movedTabId =
      draggedTabId || event.dataTransfer.getData(READER_TAB_DRAG_TYPE);
    const placement =
      dropTarget?.tabId === targetTabId ? dropTarget.placement : "before";

    event.preventDefault();
    event.stopPropagation();

    if (movedTabId && movedTabId !== targetTabId) {
      const movedIndex = tabs.findIndex((tab) => tab.id === movedTabId);
      const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);

      onReorderTab(movedTabId, targetTabId, placement);

      if (movedIndex !== -1 && targetIndex !== -1) {
        setAnnouncement(
          `${getReaderTabLabel(tabs[movedIndex]!, movedIndex)} moved ${placement} ${getReaderTabLabel(tabs[targetIndex]!, targetIndex)}.`,
        );
      }
    }

    resetDragState();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tab: ReaderTab,
    index: number,
  ) {
    if (
      !event.altKey ||
      !event.shiftKey ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }

    const moveLeft = event.key === "ArrowLeft";
    const targetIndex = index + (moveLeft ? -1 : 1);
    const targetTab = tabs[targetIndex];

    if (!targetTab) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const placement: TabPlacement = moveLeft ? "before" : "after";

    onReorderTab(tab.id, targetTab.id, placement);
    setAnnouncement(
      `${getReaderTabLabel(tab, index)} moved ${placement} ${getReaderTabLabel(targetTab, targetIndex)}.`,
    );
  }

  return (
    <div className={cn("flex items-end gap-1 px-2.5 pt-2 sm:px-3", className)}>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="mb-1 flex size-7 shrink-0 items-center justify-center">
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
      <div
        ref={tabListRef}
        aria-label="Reader tabs"
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto scrollbar-hide"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const label = getReaderTabLabel(tab, index);
          const canClose =
            tabs.length > 1 || Boolean(tab.file) || Boolean(tab.error);
          const isDropTarget = dropTarget?.tabId === tab.id;

          return (
            <div
              ref={isActive ? activeTabRef : undefined}
              className={cn(
                "group relative flex min-w-24 max-w-56 -translate-y-0.5 flex-[1_1_14rem] items-center rounded-t-lg border border-b-0 text-xs transition",
                isActive
                  ? "z-10 border-border/70 text-foreground -mb-px translate-y-0 pb-px shadow-[0_-1px_2px_rgba(0,0,0,0.04)] bg-card"
                  : "border-none bg-card/80 text-muted-foreground hover:bg-background/60 hover:text-foreground",
                draggedTabId === tab.id && "opacity-45",
              )}
              key={tab.id}
              onDragOver={(event) => handleTabDragOver(event, tab.id)}
              onDrop={(event) => handleTabDrop(event, tab.id)}
            >
              {isDropTarget ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-y-1 z-20 w-0.5 rounded-full bg-[#03444A] shadow-[0_0_0_1px_var(--background)] dark:bg-[#58D1E2]",
                    dropTarget.placement === "before" ? "-left-1" : "-right-1",
                  )}
                />
              ) : null}
              <button
                aria-keyshortcuts="Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
                aria-selected={isActive}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-t-lg py-2 pl-3 pr-1.5 text-left active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                draggable={tabs.length > 1}
                onClick={() => onSelectTab(tab.id)}
                onDragEnd={resetDragState}
                onDragStart={(event) => handleTabDragStart(event, tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab, index)}
                role="tab"
                title={`${label}${tabs.length > 1 ? " — drag to reorder" : ""}`}
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
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="New reader tab"
              className="mb-1 size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
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

      <ReaderStorageMenu
        onClearSession={onClearSession}
        status={persistenceStatus}
      />

      <div className="mb-0.5 shrink-0">
        <ModeToggle />
      </div>
    </div>
  );
}
