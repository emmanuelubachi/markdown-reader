"use client";

import { Pause, Play, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getReadAloudStatusText, useReadAloud } from "@/hooks/use-read-aloud";
import { cn } from "@/lib/utils";

export function ReadAloudToolbar({
  chunks,
  className,
}: {
  chunks: string[];
  className?: string;
}) {
  const reader = useReadAloud(chunks);
  const hasReadableText = chunks.length > 0;
  const isPlaying = reader.status === "playing";
  const isPaused = reader.status === "paused";
  const canRead = hasReadableText && reader.status !== "unsupported";
  const currentPosition =
    reader.status === "idle"
      ? 0
      : Math.min(reader.currentIndex + 1, chunks.length);
  const progress =
    chunks.length > 0 ? (currentPosition / chunks.length) * 100 : 0;
  const statusText = getReadAloudStatusText(
    reader.status,
    currentPosition,
    chunks.length,
  );

  return (
    <div
      className={cn(
        "items-center gap-2 rounded-full border border-border/80 bg-background/70 py-1 pl-2.5 pr-1.5",
        className,
      )}
    >
      <Volume2 className="size-4 shrink-0 text-[#03444A] dark:text-[#58D1E2]" />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={
                isPlaying
                  ? "Pause reading"
                  : isPaused
                    ? "Resume reading"
                    : "Read preview aloud from selection"
              }
              className="size-7 shrink-0 rounded-full"
              disabled={!canRead}
              onClick={
                isPlaying
                  ? reader.pause
                  : isPaused
                    ? reader.resume
                    : reader.startFromSelection
              }
              size="icon-sm"
              type="button"
              variant={isPlaying ? "outline" : "default"}
            />
          }
        >
          {isPlaying ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isPlaying ? "Pause" : isPaused ? "Resume" : "Read from selection"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Stop reading"
              className="size-7 shrink-0 rounded-full"
              disabled={!isPlaying && !isPaused}
              onClick={reader.stop}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <Square aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Stop</TooltipContent>
      </Tooltip>

      {/* Progress fills the reclaimed space */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          aria-label="Reading progress"
          aria-valuemax={chunks.length}
          aria-valuemin={0}
          aria-valuenow={currentPosition}
          className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          title={statusText}
        >
          <div
            className="h-full rounded-full bg-[#03444A] transition-[width] dark:bg-[#58D1E2]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="hidden shrink-0 tabular-nums text-xs text-muted-foreground md:inline">
          {hasReadableText ? `${currentPosition}/${chunks.length}` : "—"}
        </span>
      </div>

      {/* Speed */}
      <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="read-aloud-rate"
        >
          Speed
        </label>
        <input
          aria-label="Reading speed"
          className="h-1.5 w-20 accent-[#03444A] dark:accent-[#58D1E2]"
          disabled={!canRead}
          id="read-aloud-rate"
          max="1.5"
          min="0.75"
          onChange={(event) => reader.setRate(Number(event.currentTarget.value))}
          step="0.05"
          type="range"
          value={reader.rate}
        />
        <span className="w-9 text-right tabular-nums text-xs text-muted-foreground">
          {reader.rate.toFixed(2).replace(/0$/, "")}x
        </span>
      </div>
    </div>
  );
}
