export const KOKORO_VOICES = [
  { id: "af_heart", label: "Heart · American female" },
  { id: "af_bella", label: "Bella · American female" },
  { id: "af_nicole", label: "Nicole · American female, soft" },
  { id: "af_sky", label: "Sky · American female" },
  { id: "am_michael", label: "Michael · American male" },
  { id: "am_fenrir", label: "Fenrir · American male" },
  { id: "bf_emma", label: "Emma · British female" },
  { id: "bf_lily", label: "Lily · British female" },
  { id: "bm_george", label: "George · British male" },
  { id: "bm_fable", label: "Fable · British male" },
] as const;

export type KokoroVoiceId = (typeof KOKORO_VOICES)[number]["id"];

export const DEFAULT_KOKORO_VOICE: KokoroVoiceId = "af_heart";

export function isKokoroVoiceId(value: string): value is KokoroVoiceId {
  return KOKORO_VOICES.some((voice) => voice.id === value);
}

export type KokoroWorkerRequest =
  | { type: "init" }
  | { type: "generate"; id: number; text: string; voice: KokoroVoiceId };

export type KokoroWorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "init-error"; error: string }
  | { type: "result"; id: number; wav: ArrayBuffer }
  | { type: "generate-error"; id: number; error: string };
