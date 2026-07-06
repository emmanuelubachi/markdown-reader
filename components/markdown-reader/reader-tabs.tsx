"use client";

import { AlertCircle, FileText, Plus, X } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getReaderTabLabel } from "@/lib/markdown/document";
import type { ReaderTab } from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

export function ReaderTabs({
  activeTabId,
  onCloseTab,
  onNewTab,
  onSelectTab,
  tabs,
}: {
  activeTabId: string;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onSelectTab: (tabId: string) => void;
  tabs: ReaderTab[];
}) {
  return (
    <div className="flex items-end gap-1 px-2.5 pt-2 sm:px-3">
      <div
        aria-label="Reader tabs"
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const label = getReaderTabLabel(tab, index);
          const canClose =
            tabs.length > 1 || Boolean(tab.file) || Boolean(tab.error);

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

      <div className="mb-0.5 shrink-0">
        <ModeToggle />
      </div>
    </div>
  );
}
