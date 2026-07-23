"use client";

import type { KeyboardEvent } from "react";

import {
  AudioLines,
  ListTree,
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getReadAloudStatusText,
  type ReadAloudController,
  type ReadAloudStatus,
} from "@/hooks/use-read-aloud";
import { isNaturalSoundingVoice } from "@/lib/speech/device-voices";
import type { SpeechSection } from "@/lib/markdown/speech";
import { KOKORO_VOICES } from "@/lib/speech/kokoro-messages";
import { cn } from "@/lib/utils";

export function ReadAloudToolbar({
  reader,
  chunks,
  sections,
  activeTabId,
  onSelectSourceTab,
  className,
  controlIdPrefix = "read-aloud",
}: {
  reader: ReadAloudController;
  chunks: string[];
  sections: SpeechSection[];
  activeTabId: string;
  onSelectSourceTab: (tabId: string) => void;
  className?: string;
  controlIdPrefix?: string;
}) {
  const engineControlId = `${controlIdPrefix}-engine`;
  const rateControlId = `${controlIdPrefix}-rate`;
  const voiceControlId = `${controlIdPrefix}-voice`;
  const hasReadableText = chunks.length > 0;
  // The single lifted player may be reading a different tab's document. This
  // toolbar only reflects playback that belongs to the tab currently on screen.
  const isSource =
    reader.sourceTabId != null && reader.sourceTabId === activeTabId;
  const sessionActive =
    reader.status === "playing" ||
    reader.status === "paused" ||
    reader.status === "loading";
  const isBusyElsewhere =
    reader.sourceTabId != null && !isSource && sessionActive;

  const localStatus: ReadAloudStatus = isSource ? reader.status : "idle";
  const localTotal = isSource ? reader.total : chunks.length;
  const localIndex = isSource ? reader.currentIndex : 0;

  const isPlaying = isSource && reader.status === "playing";
  const isPaused = isSource && reader.status === "paused";
  const isLoading = isSource && reader.status === "loading";
  const canRead = hasReadableText && reader.status !== "unsupported";
  const currentPosition =
    localStatus === "idle" ? 0 : Math.min(localIndex + 1, localTotal);
  const progress = localTotal > 0 ? (currentPosition / localTotal) * 100 : 0;
  const statusText = getReadAloudStatusText(
    localStatus,
    currentPosition,
    localTotal,
    reader.modelProgress,
  );
  const isDownloadingModel =
    isLoading && reader.modelProgress != null && reader.modelProgress < 1;
  // Lighter "buffered ahead" fill: only for the tab actually being read, once
  // the natural voice has generated at least one passage and the model is done.
  const showBuffered =
    isSource && reader.bufferedIndex >= 0 && !isDownloadingModel;
  const bufferedPercent =
    localTotal > 0
      ? (Math.min(reader.bufferedIndex + 1, localTotal) / localTotal) * 100
      : 0;
  // Seeking only applies to a live session on the tab currently on screen.
  const canSeek = isSource && sessionActive && localTotal > 0;
  const atStart = reader.currentIndex <= 0;
  const atEnd = reader.currentIndex >= localTotal - 1;

  function seekToClientX(clientX: number, rect: DOMRect) {
    if (rect.width <= 0 || localTotal <= 0) {
      return;
    }

    const fraction = Math.min(
      Math.max((clientX - rect.left) / rect.width, 0),
      1,
    );

    reader.seek(Math.min(Math.floor(fraction * localTotal), localTotal - 1));
  }

  function handleSeekKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        reader.seek(Math.min(reader.currentIndex + 1, localTotal - 1));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        reader.seek(Math.max(reader.currentIndex - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        reader.seek(0);
        break;
      case "End":
        event.preventDefault();
        reader.seek(localTotal - 1);
        break;
    }
  }

  // Jump to a heading's section: seek if this tab is already playing, otherwise
  // start reading this tab from that section.
  function jumpToSection(chunkIndex: number) {
    if (canSeek) {
      reader.seek(chunkIndex);
    } else if (canRead) {
      reader.start(chunks, activeTabId, chunkIndex);
    }
  }

  // The section the play head currently sits in (last heading at or before it).
  const activeSectionIndex =
    isSource && sections.length > 0
      ? sections.reduce(
          (found, section, index) =>
            section.chunkIndex <= localIndex ? index : found,
          -1,
        )
      : -1;

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
              aria-keyshortcuts="ArrowLeft"
              aria-label="Rewind one passage"
              className="size-7 shrink-0 rounded-full"
              disabled={!canSeek || atStart}
              onClick={() => reader.seekBy(-1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <SkipBack aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Previous passage (←)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={
                isPlaying
                  ? "Pause reading"
                  : isPaused
                    ? "Resume reading"
                    : isLoading
                      ? "Preparing voice"
                      : "Read preview aloud from selection"
              }
              className="size-7 shrink-0 rounded-full"
              disabled={!canRead || isLoading}
              onClick={
                isPlaying
                  ? reader.pause
                  : isPaused
                    ? reader.resume
                    : () => reader.startFromSelection(chunks, activeTabId)
              }
              size="icon-sm"
              type="button"
              variant={isPlaying ? "outline" : "default"}
            />
          }
        >
          {isPlaying ? (
            <Pause aria-hidden="true" />
          ) : isLoading ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isPlaying
            ? "Pause"
            : isPaused
              ? "Resume"
              : isLoading
                ? "Preparing voice"
                : "Read from selection"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-keyshortcuts="ArrowRight"
              aria-label="Skip to next passage"
              className="size-7 shrink-0 rounded-full"
              disabled={!canSeek || atEnd}
              onClick={() => reader.seekBy(1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <SkipForward aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Next passage (→)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Stop reading"
              className="size-7 shrink-0 rounded-full"
              disabled={!isPlaying && !isPaused && !isLoading}
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
          aria-label={canSeek ? "Seek reading position" : "Reading progress"}
          aria-valuemax={localTotal}
          aria-valuemin={0}
          aria-valuenow={currentPosition}
          aria-valuetext={
            showBuffered
              ? `${currentPosition} of ${localTotal} playing, buffered to ${Math.min(
                  reader.bufferedIndex + 1,
                  localTotal,
                )}`
              : undefined
          }
          className={cn(
            "relative h-1.5 min-w-8 flex-1 rounded-full",
            canSeek &&
              "cursor-pointer before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
          onClick={
            canSeek
              ? (event) =>
                  seekToClientX(
                    event.clientX,
                    event.currentTarget.getBoundingClientRect(),
                  )
              : undefined
          }
          onKeyDown={canSeek ? handleSeekKeyDown : undefined}
          role={canSeek ? "slider" : "progressbar"}
          tabIndex={canSeek ? 0 : undefined}
          title={statusText}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
            {showBuffered ? (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#03444A]/25 transition-[width] dark:bg-[#58D1E2]/25"
                style={{ width: `${bufferedPercent}%` }}
              />
            ) : null}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full bg-[#03444A] transition-[width] dark:bg-[#58D1E2]",
                isDownloadingModel && "animate-pulse",
              )}
              style={{
                width: isDownloadingModel
                  ? `${Math.round((reader.modelProgress ?? 0) * 100)}%`
                  : `${progress}%`,
              }}
            />
          </div>
        </div>
        <span className="hidden shrink-0 tabular-nums text-xs text-muted-foreground md:inline">
          {isDownloadingModel
            ? `${Math.round((reader.modelProgress ?? 0) * 100)}%`
            : hasReadableText
              ? `${currentPosition}/${localTotal}`
              : "—"}
        </span>
      </div>

      {/* Playing-elsewhere indicator: audio belongs to another tab */}
      {isBusyElsewhere ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Go to the tab that is playing"
                className="h-7 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-medium"
                onClick={() =>
                  reader.sourceTabId && onSelectSourceTab(reader.sourceTabId)
                }
                size="sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <Music
              aria-hidden="true"
              className="size-3.5 animate-pulse text-[#03444A] dark:text-[#58D1E2]"
            />
            <span className="hidden sm:inline">Playing on another tab</span>
          </TooltipTrigger>
          <TooltipContent>Go to the tab that&rsquo;s playing</TooltipContent>
        </Tooltip>
      ) : null}

      {/* Speed */}
      <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor={rateControlId}
        >
          Speed
        </label>
        <input
          aria-label="Reading speed"
          className="h-1.5 w-20 accent-[#03444A] dark:accent-[#58D1E2]"
          disabled={!canRead}
          id={rateControlId}
          max="1.5"
          min="0.75"
          onChange={(event) =>
            reader.setRate(Number(event.currentTarget.value))
          }
          step="0.05"
          type="range"
          value={reader.rate}
        />
        <span className="w-9 text-right tabular-nums text-xs text-muted-foreground">
          {reader.rate.toFixed(2).replace(/0$/, "")}x
        </span>
      </div>

      {/* Jump to a section (heading) */}
      {sections.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Jump to section"
                className="size-7 shrink-0 rounded-full"
                disabled={!canRead}
                size="icon-sm"
                title="Jump to section"
                type="button"
                variant="ghost"
              />
            }
          >
            <ListTree aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-72 w-64 scrollbar-hide"
          >
            {sections.map((section, index) => (
              <DropdownMenuItem
                key={`${section.id}-${section.chunkIndex}`}
                className={cn(
                  index === activeSectionIndex &&
                    "font-medium text-[#03444A] dark:text-[#58D1E2]",
                )}
                onClick={() => jumpToSection(section.chunkIndex)}
                style={{ paddingLeft: `${(section.level - 1) * 12 + 8}px` }}
              >
                <span className="min-w-0 flex-1 truncate">{section.text}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {/* Voice settings */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-label="Voice settings"
              className="size-7 shrink-0 rounded-full"
              size="icon-sm"
              title="Voice settings"
              type="button"
              variant="ghost"
            />
          }
        >
          <AudioLines aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3">
          <PopoverHeader>
            <PopoverTitle>Voice settings</PopoverTitle>
            <PopoverDescription>
              Choose how the document is read aloud.
            </PopoverDescription>
          </PopoverHeader>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={engineControlId}
            >
              Engine
            </label>
            <NativeSelect
              className="w-full"
              id={engineControlId}
              onChange={(event) =>
                reader.setEngine(
                  event.currentTarget.value === "natural"
                    ? "natural"
                    : "device",
                )
              }
              size="sm"
              value={reader.engine}
            >
              <NativeSelectOption
                disabled={!reader.deviceSupported}
                value="device"
              >
                Device voice · instant
              </NativeSelectOption>
              <NativeSelectOption
                disabled={!reader.naturalSupported}
                value="natural"
              >
                Natural AI voice · on-device
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={voiceControlId}
            >
              Voice
            </label>
            {reader.engine === "device" ? (
              <NativeSelect
                className="w-full"
                id={voiceControlId}
                onChange={(event) =>
                  reader.setDeviceVoiceURI(event.currentTarget.value || null)
                }
                size="sm"
                value={reader.deviceVoiceURI ?? ""}
              >
                <NativeSelectOption value="">
                  Auto · best available
                </NativeSelectOption>
                {reader.deviceVoices.map((voice) => (
                  <NativeSelectOption
                    key={voice.voiceURI}
                    value={voice.voiceURI}
                  >
                    {voice.name} ({voice.lang})
                    {isNaturalSoundingVoice(voice) ? " ★" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <NativeSelect
                className="w-full"
                id={voiceControlId}
                onChange={(event) => {
                  const voice = KOKORO_VOICES.find(
                    (candidate) => candidate.id === event.currentTarget.value,
                  );

                  if (voice) {
                    reader.setKokoroVoice(voice.id);
                  }
                }}
                size="sm"
                value={reader.kokoroVoice}
              >
                {KOKORO_VOICES.map((voice) => (
                  <NativeSelectOption key={voice.id} value={voice.id}>
                    {voice.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {reader.engine === "natural"
              ? "The natural voice runs entirely in your browser. The first use downloads a ~90 MB model, which is then cached — no account or API key needed."
              : "Device voices play instantly. Voices marked ★ usually sound the most natural. On macOS you can add higher-quality voices in System Settings → Accessibility → Spoken Content."}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
