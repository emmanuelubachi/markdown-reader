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

  function focusTextarea() {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function pasteFromClipboard() {
    // Reading the clipboard programmatically is permission-gated. Chromium
    // grants it on a user gesture (a genuine one-click paste); Firefox/Safari
    // force a separate "Paste" confirmation we can't skip. In those browsers we
    // skip the API entirely and focus the box, so a single ⌘V / Ctrl+V pastes
    // with no prompt at all (pasting into a focused field needs no permission).
    const canReadSilently =
      "userAgentData" in navigator && Boolean(navigator.clipboard?.readText);

    if (!canReadSilently) {
      setClipboardHint("Press ⌘V or Ctrl+V to paste here.");
      focusTextarea();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        setClipboardHint("Your clipboard is empty — press ⌘V or Ctrl+V here.");
        focusTextarea();
        return;
      }

      setValue(text);
      setClipboardHint(null);
      focusTextarea();
    } catch {
      setClipboardHint("Press ⌘V or Ctrl+V to paste here.");
      focusTextarea();
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
            className="max-h-[45vh] min-h-44 resize-none font-mono text-xs leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 scrollbar-hover:scrollbar-thumb-muted-foreground/50"
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
