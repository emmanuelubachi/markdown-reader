"use client";

import { useEffect, useRef, useState } from "react";

import { getSelectedChunkIndex } from "@/lib/markdown/speech";

export type ReadAloudStatus = "idle" | "playing" | "paused" | "unsupported";

export function useReadAloud(chunks: string[]) {
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chunksRef = useRef(chunks);
  const shouldStopRef = useRef(false);
  const rateRef = useRef(1);
  const [speechStatus, setSpeechStatus] =
    useState<Exclude<ReadAloudStatus, "unsupported">>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRateState] = useState(1);
  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";
  const status: ReadAloudStatus = speechSupported
    ? speechStatus
    : "unsupported";

  useEffect(() => {
    return () => {
      shouldStopRef.current = true;
      synthesisRef.current?.cancel();
    };
  }, []);

  function getSynthesis() {
    if (!speechSupported) {
      return null;
    }

    synthesisRef.current = window.speechSynthesis;

    return synthesisRef.current;
  }

  function speakChunk(index: number) {
    const synthesis = getSynthesis();
    const readableChunks = chunksRef.current;

    if (!synthesis) {
      return;
    }

    if (!readableChunks.length || index >= readableChunks.length) {
      shouldStopRef.current = true;
      utteranceRef.current = null;
      setCurrentIndex(0);
      setSpeechStatus("idle");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(readableChunks[index]);

    utterance.rate = rateRef.current;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (shouldStopRef.current || utteranceRef.current !== utterance) {
        return;
      }

      speakChunk(index + 1);
    };
    utterance.onerror = () => {
      if (shouldStopRef.current) {
        return;
      }

      utteranceRef.current = null;
      setSpeechStatus("idle");
    };

    shouldStopRef.current = false;
    utteranceRef.current = utterance;
    setCurrentIndex(index);
    setSpeechStatus("playing");
    synthesis.speak(utterance);
  }

  function start(startIndex = 0) {
    const synthesis = getSynthesis();
    const safeStartIndex = Math.min(
      Math.max(startIndex, 0),
      Math.max(chunksRef.current.length - 1, 0),
    );

    if (!chunksRef.current.length || !synthesis) {
      return;
    }

    shouldStopRef.current = true;
    synthesis.cancel();
    shouldStopRef.current = false;
    speakChunk(safeStartIndex);
  }

  function startFromSelection() {
    start(getSelectedChunkIndex(chunksRef.current) ?? 0);
  }

  function pause() {
    const synthesis = getSynthesis();

    if (!synthesis || status !== "playing") {
      return;
    }

    synthesis.pause();
    setSpeechStatus("paused");
  }

  function resume() {
    const synthesis = getSynthesis();

    if (!synthesis || status !== "paused") {
      return;
    }

    synthesis.resume();
    setSpeechStatus("playing");
  }

  function stop() {
    shouldStopRef.current = true;
    utteranceRef.current = null;
    synthesisRef.current?.cancel();
    setCurrentIndex(0);
    setSpeechStatus("idle");
  }

  function setRate(nextRate: number) {
    const safeRate = Math.min(1.5, Math.max(0.75, nextRate));

    rateRef.current = safeRate;
    setRateState(safeRate);
  }

  return {
    currentIndex,
    pause,
    rate,
    resume,
    setRate,
    start,
    startFromSelection,
    status,
    stop,
  };
}

export function getReadAloudStatusText(
  status: ReadAloudStatus,
  currentPosition: number,
  total: number,
) {
  if (status === "unsupported") {
    return "Voice reading is unavailable in this browser.";
  }

  if (total === 0) {
    return "No readable preview text.";
  }

  if (status === "playing") {
    return `Reading ${currentPosition} of ${total}`;
  }

  if (status === "paused") {
    return `Paused at ${currentPosition} of ${total}`;
  }

  return `${total} ${total === 1 ? "passage" : "passages"} ready`;
}
