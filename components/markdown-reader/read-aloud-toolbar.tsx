"use client";

import { AudioLines, Loader2, Pause, Play, Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { getReadAloudStatusText, useReadAloud } from "@/hooks/use-read-aloud";
import { isNaturalSoundingVoice } from "@/lib/speech/device-voices";
import { KOKORO_VOICES } from "@/lib/speech/kokoro-messages";
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
  const isLoading = reader.status === "loading";
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
    reader.modelProgress,
  );
  const isDownloadingModel =
    isLoading && reader.modelProgress != null && reader.modelProgress < 1;

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
          aria-label="Reading progress"
          aria-valuemax={chunks.length}
          aria-valuemin={0}
          aria-valuenow={currentPosition}
          className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          title={statusText}
        >
          <div
            className={cn(
              "h-full rounded-full bg-[#03444A] transition-[width] dark:bg-[#58D1E2]",
              isDownloadingModel && "animate-pulse",
            )}
            style={{
              width: isDownloadingModel
                ? `${Math.round((reader.modelProgress ?? 0) * 100)}%`
                : `${progress}%`,
            }}
          />
        </div>
        <span className="hidden shrink-0 tabular-nums text-xs text-muted-foreground md:inline">
          {isDownloadingModel
            ? `${Math.round((reader.modelProgress ?? 0) * 100)}%`
            : hasReadableText
              ? `${currentPosition}/${chunks.length}`
              : "—"}
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
              htmlFor="read-aloud-engine"
            >
              Engine
            </label>
            <NativeSelect
              className="w-full"
              id="read-aloud-engine"
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
              htmlFor="read-aloud-voice"
            >
              Voice
            </label>
            {reader.engine === "device" ? (
              <NativeSelect
                className="w-full"
                id="read-aloud-voice"
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
                id="read-aloud-voice"
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
