import type {
  KokoroVoiceId,
  KokoroWorkerResponse,
} from "@/lib/speech/kokoro-messages";

const AUDIO_CACHE_LIMIT = 48;

type PendingRequest = {
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
};

export type KokoroEngineState = "idle" | "loading" | "ready" | "error";

class KokoroEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private cache = new Map<string, Blob>();
  private progressListeners = new Set<(progress: number) => void>();

  state: KokoroEngineState = "idle";
  progress = 0;

  static isSupported() {
    return (
      typeof window !== "undefined" &&
      typeof Worker !== "undefined" &&
      typeof WebAssembly !== "undefined"
    );
  }

  subscribeProgress(listener: (progress: number) => void) {
    this.progressListeners.add(listener);

    return () => {
      this.progressListeners.delete(listener);
    };
  }

  ensureReady(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    if (!KokoroEngine.isSupported()) {
      return Promise.reject(
        new Error("Natural voices are not supported in this browser."),
      );
    }

    this.state = "loading";
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.getWorker().postMessage({ type: "init" });

    return this.readyPromise;
  }

  getCached(text: string, voice: KokoroVoiceId) {
    return this.cache.get(getCacheKey(text, voice)) ?? null;
  }

  async generate(text: string, voice: KokoroVoiceId): Promise<Blob> {
    const cached = this.getCached(text, voice);

    if (cached) {
      return cached;
    }

    await this.ensureReady();

    return new Promise<Blob>((resolve, reject) => {
      const id = this.nextRequestId++;

      this.pending.set(id, {
        resolve: (blob) => {
          this.storeInCache(getCacheKey(text, voice), blob);
          resolve(blob);
        },
        reject,
      });
      this.getWorker().postMessage({ type: "generate", id, text, voice });
    });
  }

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./kokoro-worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = (event: MessageEvent<KokoroWorkerResponse>) => {
        this.handleResponse(event.data);
      };
      this.worker.onerror = () => {
        this.failEverything(new Error("The voice engine crashed."));
      };
    }

    return this.worker;
  }

  private handleResponse(response: KokoroWorkerResponse) {
    switch (response.type) {
      case "progress": {
        this.notifyProgress(response.progress);
        return;
      }
      case "ready": {
        this.state = "ready";
        this.notifyProgress(1);
        this.resolveReady?.();
        this.resolveReady = null;
        this.rejectReady = null;
        return;
      }
      case "init-error": {
        this.failEverything(new Error(response.error));
        return;
      }
      case "result": {
        const request = this.pending.get(response.id);

        this.pending.delete(response.id);
        request?.resolve(new Blob([response.wav], { type: "audio/wav" }));
        return;
      }
      case "generate-error": {
        const request = this.pending.get(response.id);

        this.pending.delete(response.id);
        request?.reject(new Error(response.error));
        return;
      }
    }
  }

  private notifyProgress(progress: number) {
    this.progress = progress;

    for (const listener of this.progressListeners) {
      listener(progress);
    }
  }

  private failEverything(error: Error) {
    this.state = "error";
    this.rejectReady?.(error);
    this.resolveReady = null;
    this.rejectReady = null;
    this.readyPromise = null;

    for (const request of this.pending.values()) {
      request.reject(error);
    }

    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private storeInCache(key: string, blob: Blob) {
    if (this.cache.has(key)) {
      return;
    }

    if (this.cache.size >= AUDIO_CACHE_LIMIT) {
      const oldestKey = this.cache.keys().next().value;

      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, blob);
  }
}

function getCacheKey(text: string, voice: KokoroVoiceId) {
  return `${voice}|${text}`;
}

let engine: KokoroEngine | null = null;

export function getKokoroEngine() {
  engine ??= new KokoroEngine();

  return engine;
}

export function isKokoroSupported() {
  return KokoroEngine.isSupported();
}
