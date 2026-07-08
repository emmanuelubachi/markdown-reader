"use client";

import { useState } from "react";
import {
  AlertCircle,
  FileText,
  HardDrive,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getReaderTabLabel } from "@/lib/markdown/document";
import type { ReaderTab } from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

type ReaderPersistenceStatus =
  | "error"
  | "restoring"
  | "saved"
  | "saving"
  | "unavailable";

export function ReaderTabs({
  activeTabId,
  onClearSession,
  onCloseTab,
  onNewTab,
  onSelectTab,
  persistenceStatus,
  tabs,
}: {
  activeTabId: string;
  onClearSession: () => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onSelectTab: (tabId: string) => void;
  persistenceStatus: ReaderPersistenceStatus;
  tabs: ReaderTab[];
}) {
  return (
    <div className="flex items-end gap-1 px-2.5 pt-2 sm:px-3">
      <div
        aria-label="Reader tabs"
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto scrollbar-hide"
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

function ReaderStorageMenu({
  onClearSession,
  status,
}: {
  onClearSession: () => void;
  status: ReaderPersistenceStatus;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Nothing is stored when persistence is unavailable — no control to show.
  if (status === "unavailable") {
    return null;
  }

  const isBusy = status === "restoring" || status === "saving";
  const isError = status === "error";
  const statusLabel =
    status === "restoring"
      ? "Restoring your session…"
      : status === "saving"
        ? "Saving to this browser…"
        : status === "error"
          ? "Autosave paused"
          : "Saved to this browser";

  const StatusIcon = isBusy ? LoaderCircle : isError ? AlertCircle : HardDrive;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={statusLabel}
              className={cn(
                "mb-0.5 size-9 shrink-0",
                isError
                  ? "text-destructive"
                  : isBusy
                    ? "text-[#03444A] dark:text-[#58D1E2]"
                    : "text-muted-foreground",
              )}
              size="icon"
              type="button"
              variant="ghost"
            />
          }
        >
          <StatusIcon
            className={cn("size-4", isBusy && "animate-spin")}
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <StatusIcon
              className={cn(
                "size-3.5 shrink-0",
                isBusy && "animate-spin",
                isError && "text-destructive",
              )}
              aria-hidden="true"
            />
            {statusLabel}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsConfirmOpen(true)}
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
            Clear saved documents
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear saved documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every tab saved in this browser and starts a new,
              empty session. Documents open right now will be closed. This
              can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClearSession();
                setIsConfirmOpen(false);
              }}
              variant="destructive"
            >
              Clear documents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
