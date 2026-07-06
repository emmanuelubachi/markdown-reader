"use client";

import { FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes, formatDate } from "@/lib/markdown/document";
import type { DocumentStats, LoadedFile } from "@/lib/markdown/types";

export function FileSummary({
  file,
  onReset,
  stats,
}: {
  file: LoadedFile;
  onReset: () => void;
  stats: DocumentStats;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-[#8EA8AC]/35 bg-[#8EA8AC]/15 text-[#03444A] dark:text-[#58D1E2]">
          <FileText className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatBytes(file.size)} ·{" "}
            {file.source === "paste" ? "pasted" : "edited"}{" "}
            {formatDate(file.lastModified)}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Remove document"
                className="-mr-1 -mt-1 size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <X aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Remove document</TooltipContent>
        </Tooltip>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60 text-center">
        <Stat label="Words" value={stats.words.toLocaleString()} />
        <Stat label="Lines" value={stats.lines.toLocaleString()} />
        <Stat label="Read" value={`${stats.readingMinutes}m`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-2 py-2.5">
      <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
