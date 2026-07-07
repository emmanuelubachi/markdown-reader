const NATURAL_NAME_HINTS = [
  "natural",
  "neural",
  "premium",
  "enhanced",
  "siri",
] as const;

const VOICES_LOAD_TIMEOUT_MS = 2_000;

export function loadDeviceVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }

  const synthesis = window.speechSynthesis;
  const immediateVoices = synthesis.getVoices();

  if (immediateVoices.length > 0) {
    return Promise.resolve(immediateVoices);
  }

  return new Promise((resolve) => {
    let settled = false;

    function settle() {
      if (settled) {
        return;
      }

      settled = true;
      synthesis.removeEventListener("voiceschanged", settle);
      resolve(synthesis.getVoices());
    }

    synthesis.addEventListener("voiceschanged", settle);
    window.setTimeout(settle, VOICES_LOAD_TIMEOUT_MS);
  });
}

export function rankDeviceVoices(voices: SpeechSynthesisVoice[]) {
  const preferredLang = getPreferredLanguagePrefix();

  return [...voices].sort((a, b) => {
    const scoreDelta = scoreVoice(b, preferredLang) - scoreVoice(a, preferredLang);

    return scoreDelta !== 0 ? scoreDelta : a.name.localeCompare(b.name);
  });
}

export function isNaturalSoundingVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();

  return (
    NATURAL_NAME_HINTS.some((hint) => name.includes(hint)) ||
    name.includes("google")
  );
}

function scoreVoice(voice: SpeechSynthesisVoice, preferredLang: string) {
  const name = voice.name.toLowerCase();
  let score = 0;

  if (voice.lang.toLowerCase().startsWith(preferredLang)) {
    score += 40;
  } else if (voice.lang.toLowerCase().startsWith("en")) {
    score += 20;
  }

  if (name.includes("natural") || name.includes("neural")) {
    score += 12;
  }

  if (name.includes("premium") || name.includes("enhanced")) {
    score += 10;
  }

  if (name.includes("siri")) {
    score += 8;
  }

  if (name.includes("google")) {
    score += 6;
  }

  if (name.includes("compact") || name.includes("eloquence")) {
    score -= 10;
  }

  if (voice.default) {
    score += 1;
  }

  return score;
}

function getPreferredLanguagePrefix() {
  if (typeof navigator === "undefined" || !navigator.language) {
    return "en";
  }

  return navigator.language.slice(0, 2).toLowerCase();
}
