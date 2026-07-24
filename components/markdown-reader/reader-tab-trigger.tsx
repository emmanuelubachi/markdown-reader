"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { AlertCircle, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { normalizeMarkdownDocumentName } from "@/lib/markdown/document";
import type { ReaderTab } from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

export function ReaderTabTrigger({
  canClose,
  canDrag,
  isActive,
  label,
  onClose,
  onDragEnd,
  onDragStart,
  onKeyDown,
  onRename,
  onSelect,
  tab,
}: {
  canClose: boolean;
  canDrag: boolean;
  isActive: boolean;
  label: string;
  onClose: () => void;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onRename: (name: string) => void;
  onSelect: () => void;
  tab: ReaderTab;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    const input = inputRef.current;

    if (!isRenaming || !input) {
      return;
    }

    input.focus();

    const extensionStart = input.value.search(
      /\.(?:md|markdown|mdown|mkd)$/i,
    );

    input.setSelectionRange(
      0,
      extensionStart === -1 ? input.value.length : extensionStart,
    );
  }, [isRenaming]);

  function beginRenaming() {
    if (!tab.file) {
      return;
    }

    onSelect();
    setDraftName(tab.file.name);
    setIsInvalid(false);
    setIsRenaming(true);
  }

  function cancelRenaming() {
    setDraftName("");
    setIsInvalid(false);
    setIsRenaming(false);
  }

  function commitRename(cancelIfInvalid = false) {
    const nextName = normalizeMarkdownDocumentName(draftName);

    if (!nextName) {
      if (cancelIfInvalid) {
        cancelRenaming();
      } else {
        setIsInvalid(true);
        inputRef.current?.focus();
      }

      return;
    }

    if (nextName !== tab.file?.name) {
      onRename(nextName);
    }

    setDraftName("");
    setIsInvalid(false);
    setIsRenaming(false);
  }

  const icon = tab.error ? (
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
  );

  return (
    <>
      {isRenaming ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-1.5">
          {icon}
          <input
            ref={inputRef}
            aria-invalid={isInvalid}
            aria-label={`Rename ${label}`}
            className="h-5 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 text-xs outline-none selection:bg-[#58D1E2]/30 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            maxLength={180}
            onBlur={() => commitRename(true)}
            onChange={(event) => {
              setDraftName(event.currentTarget.value);
              setIsInvalid(false);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancelRenaming();
              }
            }}
            value={draftName}
          />
          {isInvalid ? (
            <span aria-live="polite" className="sr-only">
              Enter a document name.
            </span>
          ) : null}
        </div>
      ) : (
        <button
          aria-keyshortcuts={
            tab.file
              ? "F2 Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
              : "Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
          }
          aria-selected={isActive}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-t-lg py-2 pl-3 pr-1.5 text-left active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          draggable={canDrag}
          onClick={onSelect}
          onDoubleClick={(event) => {
            event.preventDefault();
            beginRenaming();
          }}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onKeyDown={(event) => {
            if (event.key === "F2" && tab.file) {
              event.preventDefault();
              event.stopPropagation();
              beginRenaming();
              return;
            }

            onKeyDown(event);
          }}
          role="tab"
          title={
            tab.file
              ? `${label} — double-click or press F2 to rename${canDrag ? " · drag to reorder" : ""}`
              : `${label}${canDrag ? " — drag to reorder" : ""}`
          }
          type="button"
        >
          {icon}
          <span className="truncate">{label}</span>
        </button>
      )}

      {canClose ? (
        <Button
          aria-label={`Close ${label}`}
          className={cn(
            "mr-1.5 size-5 shrink-0 opacity-70 transition group-hover:opacity-100",
            !isActive && "sm:opacity-0 sm:group-hover:opacity-100",
          )}
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </>
  );
}
