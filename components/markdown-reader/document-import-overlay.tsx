"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentImportProgress } from "@/hooks/use-markdown-files";

export function DocumentImportOverlay({
  onCancel,
  progress,
}: {
  onCancel: () => void;
  progress: DocumentImportProgress;
}) {
  const pagePercent = progress.totalPages
    ? Math.round((progress.page / progress.totalPages) * 100)
    : null;
  const status = progress.totalPages
    ? `Extracting page ${progress.page} of ${progress.totalPages}`
    : "Preparing document";

  return (
    <Dialog onOpenChange={(open) => !open && onCancel()} open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <FileText aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle>Opening document</DialogTitle>
              <DialogDescription className="truncate">
                {progress.fileName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {pagePercent === null ? (
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner />
            {status}
          </div>
        ) : (
          <Progress aria-label={status} value={pagePercent}>
            <ProgressLabel id="document-import-status">{status}</ProgressLabel>
            <ProgressValue />
          </Progress>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            File {progress.fileIndex} of {progress.fileCount} · processed locally
          </p>
          <Button onClick={onCancel} size="sm" type="button" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
