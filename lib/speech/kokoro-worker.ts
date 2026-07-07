import { KokoroTTS } from "kokoro-js";

import type {
  KokoroWorkerRequest,
  KokoroWorkerResponse,
} from "@/lib/speech/kokoro-messages";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

const scope = self as unknown as {
  postMessage(message: KokoroWorkerResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<KokoroWorkerRequest>) => void,
  ): void;
};

let ttsPromise: Promise<KokoroTTS> | null = null;

async function detectDevice(): Promise<"webgpu" | "wasm"> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } })
    .gpu;

  if (!gpu) {
    return "wasm";
  }

  try {
    return (await gpu.requestAdapter()) ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

function loadModel() {
  ttsPromise ??= (async () => {
    const device = await detectDevice();
    const fileProgress = new Map<string, { loaded: number; total: number }>();

    const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: device === "webgpu" ? "fp32" : "q8",
      device,
      progress_callback: (info) => {
        if (info.status !== "progress") {
          return;
        }

        fileProgress.set(info.file, {
          loaded: info.loaded ?? 0,
          total: info.total ?? 0,
        });

        let loaded = 0;
        let total = 0;

        for (const file of fileProgress.values()) {
          loaded += file.loaded;
          total += file.total;
        }

        scope.postMessage({
          type: "progress",
          progress: total > 0 ? loaded / total : 0,
        });
      },
    });

    scope.postMessage({ type: "ready", device });

    return tts;
  })();

  return ttsPromise;
}

scope.addEventListener("message", (event) => {
  void handleRequest(event.data);
});

async function handleRequest(request: KokoroWorkerRequest) {
  if (request.type === "init") {
    try {
      await loadModel();
    } catch (error) {
      ttsPromise = null;
      scope.postMessage({ type: "init-error", error: toErrorMessage(error) });
    }

    return;
  }

  try {
    const tts = await loadModel();
    const audio = await tts.generate(request.text, { voice: request.voice });
    const wav = audio.toWav();

    scope.postMessage({ type: "result", id: request.id, wav }, [wav]);
  } catch (error) {
    scope.postMessage({
      type: "generate-error",
      id: request.id,
      error: toErrorMessage(error),
    });
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
