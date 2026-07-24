"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Palette,
  PencilLine,
  Ungroup,
} from "lucide-react";

import {
  TAB_GROUP_COLOR_LABELS,
  TAB_GROUP_DOT_CLASSES,
  TAB_GROUP_PILL_CLASSES,
} from "@/components/markdown-reader/tab-group-styles";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  normalizeTabGroupName,
  READER_TAB_GROUP_COLORS,
} from "@/lib/markdown/tab-groups";
import type {
  ReaderTabGroup,
  ReaderTabGroupColor,
} from "@/lib/markdown/types";
import { cn } from "@/lib/utils";

export function ReaderTabGroupLabel({
  group,
  hasActiveTab,
  onColorChange,
  onRename,
  onToggle,
  onUngroup,
  tabCount,
}: {
  group: ReaderTabGroup;
  hasActiveTab: boolean;
  onColorChange: (color: ReaderTabGroupColor) => void;
  onRename: (name: string) => void;
  onToggle: () => void;
  onUngroup: () => void;
  tabCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  function beginRenaming() {
    setDraftName(group.name);
    setIsInvalid(false);
    setIsRenaming(true);
  }

  function cancelRenaming() {
    setDraftName("");
    setIsInvalid(false);
    setIsRenaming(false);
  }

  function commitRename(cancelIfInvalid = false) {
    const name = normalizeTabGroupName(draftName);

    if (!name) {
      if (cancelIfInvalid) {
        cancelRenaming();
      } else {
        setIsInvalid(true);
        inputRef.current?.focus();
      }

      return;
    }

    if (name !== group.name) {
      onRename(name);
    }

    cancelRenaming();
  }

  if (isRenaming) {
    return (
      <div
        className={cn(
          "mb-1 flex h-7 w-32 shrink-0 items-center rounded-md border px-2.5 shadow-xs",
          TAB_GROUP_PILL_CLASSES[group.color],
        )}
      >
        <input
          ref={inputRef}
          aria-invalid={isInvalid}
          aria-label={`Rename ${group.name} group`}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
          maxLength={40}
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
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            aria-expanded={!group.collapsed}
            aria-keyshortcuts="F2"
            aria-label={`${group.name} group, ${tabCount} tab${tabCount === 1 ? "" : "s"}`}
            className={cn(
              "mb-1 flex h-7 max-w-36 shrink-0 items-center rounded-md border px-2.5 text-xs font-semibold outline-none shadow-xs transition-[background-color,border-color,box-shadow,filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 dark:hover:brightness-110",
              TAB_GROUP_PILL_CLASSES[group.color],
              hasActiveTab && "ring-2 ring-ring/35",
            )}
            onClick={onToggle}
            onDoubleClick={(event) => {
              event.preventDefault();
              beginRenaming();
            }}
            onKeyDown={(event) => {
              if (event.key === "F2") {
                event.preventDefault();
                beginRenaming();
              }
            }}
            title={`${group.collapsed ? "Expand" : "Collapse"} ${group.name} · double-click or press F2 to rename`}
            type="button"
          />
        }
      >
        <span className="truncate">{group.name}</span>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={beginRenaming}>
          <PencilLine aria-hidden="true" />
          Rename group
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Palette aria-hidden="true" />
            Group color
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {READER_TAB_GROUP_COLORS.map((color) => (
              <ContextMenuItem
                key={color}
                onClick={() => onColorChange(color)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 rounded-full",
                    TAB_GROUP_DOT_CLASSES[color],
                  )}
                />
                {TAB_GROUP_COLOR_LABELS[color]}
                {group.color === color ? (
                  <Check aria-hidden="true" className="ml-auto" />
                ) : null}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onUngroup}>
          <Ungroup aria-hidden="true" />
          Ungroup tabs
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
