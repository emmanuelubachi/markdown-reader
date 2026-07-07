"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  loadDeviceVoices,
  rankDeviceVoices,
} from "@/lib/speech/device-voices";
import { getKokoroEngine, isKokoroSupported } from "@/lib/speech/kokoro-engine";
import {
  DEFAULT_KOKORO_VOICE,
  isKokoroVoiceId,
  type KokoroVoiceId,
} from "@/lib/speech/kokoro-messages";
import { getSelectedChunkIndex } from "@/lib/markdown/speech";

export type ReadAloudStatus =
  | "idle"
  | "playing"
  | "paused"
  | "loading"
  | "unsupported";

export type ReadAloudEngine = "device" | "natural";

const STORAGE_KEY = "markdown-reader:read-aloud";

type StoredPrefs = {
  engine?: ReadAloudEngine;
  deviceVoiceURI?: string | null;
  kokoroVoice?: string;
  rate?: number;
};

function readStoredPrefs(): StoredPrefs {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as StoredPrefs) : {};
  } catch {
    return {};
  }
}

function writeStoredPrefs(partial: StoredPrefs) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readStoredPrefs(), ...partial }),
    );
  } catch {
    // Persistence is best-effort only.
  }
}

function subscribeToKokoroProgress(onStoreChange: () => void) {
  if (!isKokoroSupported()) {
    return () => undefined;
  }

  return getKokoroEngine().subscribeProgress(onStoreChange);
}

function getKokoroProgressSnapshot(): number | null {
  return isKokoroSupported() ? getKokoroEngine().progress : null;
}

function getKokoroProgressServerSnapshot(): number | null {
  return null;
}

export function useReadAloud(chunks: string[]) {
  const chunksRef = useRef(chunks);
  const sessionRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [speechStatus, setSpeechStatus] =
    useState<Exclude<ReadAloudStatus, "unsupported">>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRateState] = useState(() => {
    const storedRate = readStoredPrefs().rate;

    return typeof storedRate === "number" && Number.isFinite(storedRate)
      ? Math.min(1.5, Math.max(0.75, storedRate))
      : 1;
  });
  const [engine, setEngineState] = useState<ReadAloudEngine>(() =>
    readStoredPrefs().engine === "natural" && isKokoroSupported()
      ? "natural"
      : "device",
  );
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [deviceVoiceURI, setDeviceVoiceURIState] = useState<string | null>(
    () => readStoredPrefs().deviceVoiceURI ?? null,
  );
  const [kokoroVoice, setKokoroVoiceState] = useState<KokoroVoiceId>(() => {
    const storedVoice = readStoredPrefs().kokoroVoice;

    return storedVoice && isKokoroVoiceId(storedVoice)
      ? storedVoice
      : DEFAULT_KOKORO_VOICE;
  });
  const modelProgress = useSyncExternalStore(
    subscribeToKokoroProgress,
    getKokoroProgressSnapshot,
    getKokoroProgressServerSnapshot,
  );

  chunksRef.current = chunks;

  const rateRef = useRef(rate);
  const engineRef = useRef(engine);
  const deviceVoicesRef = useRef(deviceVoices);
  const deviceVoiceURIRef = useRef(deviceVoiceURI);
  const kokoroVoiceRef = useRef(kokoroVoice);

  rateRef.current = rate;
  engineRef.current = engine;
  deviceVoicesRef.current = deviceVoices;
  deviceVoiceURIRef.current = deviceVoiceURI;
  kokoroVoiceRef.current = kokoroVoice;

  const deviceSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";
  const naturalSupported = isKokoroSupported();
  const engineSupported = engine === "device" ? deviceSupported : naturalSupported;
  const status: ReadAloudStatus = engineSupported ? speechStatus : "unsupported";

  useEffect(() => {
    if (!deviceSupported) {
      return;
    }

    let active = true;

    function refreshVoices() {
      void loadDeviceVoices().then((voices) => {
        if (active) {
          setDeviceVoices(rankDeviceVoices(voices));
        }
      });
    }

    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);

    return () => {
      active = false;
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoices,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Shared teardown for both React unmount (tab close/switch) and a hard
    // browser tab/window close, where unmount effects are not guaranteed to run
    // and speechSynthesis — a browser-global service — can keep speaking.
    function teardown() {
      sessionRef.current += 1;

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      cleanupAudio();
    }

    window.addEventListener("pagehide", teardown);

    return () => {
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
  }, []);

  function cleanupAudio() {
    const audio = audioRef.current;

    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function finishPlayback(session: number) {
    if (session !== sessionRef.current) {
      return;
    }

    cleanupAudio();
    setCurrentIndex(0);
    setSpeechStatus("idle");
  }

  function resolveDeviceVoice() {
    const voices = deviceVoicesRef.current;
    const preferredURI = deviceVoiceURIRef.current;

    if (preferredURI) {
      const preferred = voices.find(
        (voice) => voice.voiceURI === preferredURI,
      );

      if (preferred) {
        return preferred;
      }
    }

    return voices[0] ?? null;
  }

  function speakDeviceChunk(index: number, session: number) {
    if (session !== sessionRef.current || !deviceSupported) {
      return;
    }

    const readableChunks = chunksRef.current;

    if (index >= readableChunks.length) {
      finishPlayback(session);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(readableChunks[index]);
    const voice = resolveDeviceVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.rate = rateRef.current;
    utterance.pitch = 1;
    utterance.onend = () => {
      if (session === sessionRef.current) {
        speakDeviceChunk(index + 1, session);
      }
    };
    utterance.onerror = () => {
      if (session === sessionRef.current) {
        setSpeechStatus("idle");
      }
    };

    setCurrentIndex(index);
    setSpeechStatus("playing");
    window.speechSynthesis.speak(utterance);
  }

  async function playNaturalChunk(index: number, session: number) {
    if (session !== sessionRef.current) {
      return;
    }

    const readableChunks = chunksRef.current;

    if (index >= readableChunks.length) {
      finishPlayback(session);
      return;
    }

    const kokoro = getKokoroEngine();
    const voice = kokoroVoiceRef.current;
    const cached = kokoro.getCached(readableChunks[index], voice);

    setCurrentIndex(index);

    if (!cached) {
      setSpeechStatus("loading");
    }

    let blob: Blob;

    try {
      blob = cached ?? (await kokoro.generate(readableChunks[index], voice));
    } catch {
      if (session === sessionRef.current) {
        setSpeechStatus("idle");
      }

      return;
    }

    if (session !== sessionRef.current) {
      return;
    }

    if (index + 1 < readableChunks.length) {
      void kokoro
        .generate(readableChunks[index + 1], voice)
        .catch(() => undefined);
    }

    cleanupAudio();

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    objectUrlRef.current = url;
    audioRef.current = audio;
    audio.playbackRate = rateRef.current;
    audio.onended = () => {
      if (session === sessionRef.current) {
        void playNaturalChunk(index + 1, session);
      }
    };
    audio.onerror = () => {
      if (session === sessionRef.current) {
        setSpeechStatus("idle");
      }
    };

    setSpeechStatus("playing");
    void audio.play().catch(() => {
      if (session === sessionRef.current) {
        setSpeechStatus("idle");
      }
    });
  }

  function start(startIndex = 0) {
    const readableChunks = chunksRef.current;

    if (!readableChunks.length || !engineSupported) {
      return;
    }

    const safeStartIndex = Math.min(
      Math.max(startIndex, 0),
      readableChunks.length - 1,
    );

    sessionRef.current += 1;

    const session = sessionRef.current;

    if (deviceSupported) {
      window.speechSynthesis.cancel();
    }

    cleanupAudio();

    if (engineRef.current === "natural") {
      void playNaturalChunk(safeStartIndex, session);
    } else {
      speakDeviceChunk(safeStartIndex, session);
    }
  }

  function startFromSelection() {
    start(getSelectedChunkIndex(chunksRef.current) ?? 0);
  }

  function pause() {
    if (status !== "playing") {
      return;
    }

    if (engineRef.current === "natural") {
      audioRef.current?.pause();
    } else if (deviceSupported) {
      window.speechSynthesis.pause();
    }

    setSpeechStatus("paused");
  }

  function resume() {
    if (status !== "paused") {
      return;
    }

    if (engineRef.current === "natural") {
      void audioRef.current?.play().catch(() => setSpeechStatus("idle"));
    } else if (deviceSupported) {
      window.speechSynthesis.resume();
    }

    setSpeechStatus("playing");
  }

  function stop() {
    sessionRef.current += 1;

    if (deviceSupported) {
      window.speechSynthesis.cancel();
    }

    cleanupAudio();
    setCurrentIndex(0);
    setSpeechStatus("idle");
  }

  function setRate(nextRate: number) {
    const safeRate = Math.min(1.5, Math.max(0.75, nextRate));

    setRateState(safeRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = safeRate;
    }

    writeStoredPrefs({ rate: safeRate });
  }

  function setEngine(nextEngine: ReadAloudEngine) {
    if (nextEngine === engineRef.current) {
      return;
    }

    stop();
    setEngineState(nextEngine);
    writeStoredPrefs({ engine: nextEngine });
  }

  function setDeviceVoiceURI(nextVoiceURI: string | null) {
    setDeviceVoiceURIState(nextVoiceURI);
    writeStoredPrefs({ deviceVoiceURI: nextVoiceURI });
  }

  function setKokoroVoice(nextVoice: KokoroVoiceId) {
    setKokoroVoiceState(nextVoice);
    writeStoredPrefs({ kokoroVoice: nextVoice });
  }

  return {
    currentIndex,
    deviceSupported,
    deviceVoiceURI,
    deviceVoices,
    engine,
    kokoroVoice,
    modelProgress,
    naturalSupported,
    pause,
    rate,
    resume,
    setDeviceVoiceURI,
    setEngine,
    setKokoroVoice,
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
  modelProgress?: number | null,
) {
  if (status === "unsupported") {
    return "Voice reading is unavailable in this browser.";
  }

  if (total === 0) {
    return "No readable preview text.";
  }

  if (status === "loading") {
    return modelProgress != null && modelProgress < 1
      ? `Downloading voice model… ${Math.round(modelProgress * 100)}%`
      : "Preparing natural voice…";
  }

  if (status === "playing") {
    return `Reading ${currentPosition} of ${total}`;
  }

  if (status === "paused") {
    return `Paused at ${currentPosition} of ${total}`;
  }

  return `${total} ${total === 1 ? "passage" : "passages"} ready`;
}
