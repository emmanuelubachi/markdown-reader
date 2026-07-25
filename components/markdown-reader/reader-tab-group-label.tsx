"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
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
  canDrag,
  dropPlacement,
  group,
  isDragging,
  onColorChange,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMoveByKeyboard,
  onRename,
  onToggle,
  onUngroup,
  tabCount,
}: {
  canDrag: boolean;
  dropPlacement: null | "after" | "before";
  group: ReaderTabGroup;
  isDragging: boolean;
  onColorChange: (color: ReaderTabGroupColor) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onMoveByKeyboard: (direction: "left" | "right") => void;
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
          "mx-0.5 mb-1 flex h-6 w-28 shrink-0 items-center rounded px-2",
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
            aria-keyshortcuts="F2 Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
            aria-label={`${group.name} group, ${tabCount} tab${tabCount === 1 ? "" : "s"}`}
            className={cn(
              "relative mx-0.5 mb-1 flex h-6 max-w-32 shrink-0 items-center rounded px-2 text-[11px] font-semibold outline-none transition-[background-color,filter,opacity] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:brightness-110",
              canDrag && "cursor-grab active:cursor-grabbing",
              TAB_GROUP_PILL_CLASSES[group.color],
              isDragging && "opacity-45",
            )}
            draggable={canDrag}
            onClick={onToggle}
            onDoubleClick={(event) => {
              event.preventDefault();
              beginRenaming();
            }}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onKeyDown={(event) => {
              if (event.key === "F2") {
                event.preventDefault();
                beginRenaming();
              } else if (
                event.altKey &&
                event.shiftKey &&
                (event.key === "ArrowLeft" || event.key === "ArrowRight")
              ) {
                event.preventDefault();
                event.stopPropagation();
                onMoveByKeyboard(
                  event.key === "ArrowLeft" ? "left" : "right",
                );
              }
            }}
            title={`${group.collapsed ? "Expand" : "Collapse"} ${group.name} · drag to reorder · double-click or press F2 to rename`}
            type="button"
          />
        }
      >
        {dropPlacement ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 z-20 w-0.5 rounded-full shadow-[0_0_0_1px_var(--background)]",
              TAB_GROUP_DOT_CLASSES[group.color],
              dropPlacement === "before" ? "-left-1.5" : "-right-1.5",
            )}
          />
        ) : null}
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
