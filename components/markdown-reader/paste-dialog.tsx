"use client";

import { useMemo, useRef, useState } from "react";
import { ClipboardPaste } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_SIZE } from "@/lib/markdown/constants";
import { formatBytes } from "@/lib/markdown/document";
import { getDocumentStats } from "@/lib/markdown/stats";

export function PasteMarkdownDialog({
  onImport,
  onOpenChange,
  open,
}: {
  onImport: (text: string) => boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [clipboardHint, setClipboardHint] = useState<null | string>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setValue("");
      setClipboardHint(null);
    }

    onOpenChange(nextOpen);
  }

  const trimmedValue = value.trim();
  const byteSize = useMemo(() => new Blob([value]).size, [value]);
  const wordCount = useMemo(
    () => (trimmedValue ? getDocumentStats(value).words : 0),
    [trimmedValue, value],
  );
  const isTooLarge = byteSize > MAX_FILE_SIZE;
  const canImport = Boolean(trimmedValue) && !isTooLarge;

  async function pasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setClipboardHint(
        "Clipboard access is unavailable — paste with your keyboard.",
      );
      return;
    }

    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        setClipboardHint("Your clipboard is empty.");
        return;
      }

      setValue(text);
      setClipboardHint(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      setClipboardHint(
        "Clipboard access was blocked — paste with your keyboard instead.",
      );
    }
  }

  function handleImport() {
    if (!canImport) {
      return;
    }

    if (onImport(value)) {
      handleOpenChange(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-xl"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            handleImport();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Paste markdown</DialogTitle>
          <DialogDescription>
            Paste or type markdown below. It stays in your browser — nothing is
            uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            aria-invalid={isTooLarge}
            aria-label="Markdown to import"
            autoFocus
            className="max-h-[45vh] min-h-44 resize-none font-mono text-xs leading-relaxed"
            onChange={(event) => setValue(event.currentTarget.value)}
            placeholder={"# Title\n\nPaste your markdown here…"}
            ref={textareaRef}
            spellCheck={false}
            value={value}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              onClick={pasteFromClipboard}
              size="sm"
              type="button"
              variant="outline"
            >
              <ClipboardPaste aria-hidden="true" />
              Paste from clipboard
            </Button>
            <p className="text-xs tabular-nums text-muted-foreground">
              {isTooLarge ? (
                <span className="text-destructive">
                  {formatBytes(byteSize)} · over the 5 MB limit
                </span>
              ) : (
                `${wordCount.toLocaleString()} ${wordCount === 1 ? "word" : "words"}`
              )}
            </p>
          </div>
          {clipboardHint ? (
            <p className="text-xs text-muted-foreground">{clipboardHint}</p>
          ) : null}
        </div>

        <DialogFooter>
          <p className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
            to open
          </p>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={!canImport} onClick={handleImport} type="button">
            Open document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
