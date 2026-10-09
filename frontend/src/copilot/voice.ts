/** Riyah's voice in the browser: record the microphone as a small WAV (16 kHz, mono) that any speech model accepts,
 * and speak a reply aloud (the server's voice when available, else the device's own voices). */
import { api } from "../api/client";

export const voiceSupported = () =>
  typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export interface Recorder {
  /** Stops recording and resolves with the WAV. */
  stop: () => Promise<Blob>;
  cancel: () => void;
}

function encodeWav(samples: Float32Array, inRate: number, outRate = 16000): Blob {
  const ratio = inRate / outRate;
  const n = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio), end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const v = Math.max(-1, Math.min(1, end > start ? sum / (end - start) : 0));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true); view.setUint32(28, outRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

/** Starts recording. `onLevel` gets the loudness (0..1) for a live meter; `onLimit` fires if the limit (seconds) is reached. */
export async function startRecording(onLevel?: (level: number) => void, maxSeconds = 60, onLimit?: () => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let stopped = false;
  node.onaudioprocess = (e) => {
    if (stopped) return;
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    if (onLevel) {
      let s = 0;
      for (let i = 0; i < data.length; i++) s += data[i] * data[i];
      onLevel(Math.min(1, Math.sqrt(s / data.length) * 4));
    }
  };
  source.connect(node);
  node.connect(ctx.destination);
  const timer = window.setTimeout(() => onLimit?.(), maxSeconds * 1000);
  const release = () => {
    stopped = true;
    window.clearTimeout(timer);
    node.disconnect(); source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return {
    stop: async () => {
      const rate = ctx.sampleRate;
      release();
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const all = new Float32Array(total);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      return encodeWav(all, rate);
    },
    cancel: release,
  };
}

// ----------------------------------------------------------------------------------------------- speaking

const CODES: Record<string, string> = {
  English: "en-US", Arabic: "ar-SA", Hindi: "hi-IN", Tamil: "ta-IN", Urdu: "ur-PK", French: "fr-FR", Spanish: "es-ES", Bengali: "bn-IN",
  Malayalam: "ml-IN", Telugu: "te-IN", Kannada: "kn-IN", Marathi: "mr-IN", Gujarati: "gu-IN", Punjabi: "pa-IN", Persian: "fa-IR",
  Turkish: "tr-TR", German: "de-DE", Russian: "ru-RU", Chinese: "zh-CN", Indonesian: "id-ID", Portuguese: "pt-PT", Italian: "it-IT",
};
export const speechTag = (language: string) => CODES[language] ?? "en-US";

/** Reads like speech: no markdown marks, tables, code, links or maths delimiters. */
export function plainForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ").replace(/`([^`]*)`/g, "$1").replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$([^$]*)\$/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ").replace(/^[-*+]\s+/gm, "").replace(/^#{1,6}\s*/gm, "").replace(/[*_~>#]/g, "").replace(/\s+/g, " ").trim();
}

let stopCurrent: (() => void) | null = null;
export function stopSpeaking() {
  stopCurrent?.();
  stopCurrent = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

async function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  const first = speechSynthesis.getVoices();
  if (first.length) return first;
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    window.setTimeout(done, 700);
  });
}

export type SpeakResult = "server" | "browser" | "no-voice" | "unsupported";

/** Speaks `text` in `language`. Uses the server's voice when asked and available, otherwise a voice installed on the device;
 * "no-voice" means the device has no voice for that language (the reply is still shown as text). */
export async function speak(text: string, language: string, opts: { server: boolean; onEnd?: () => void }): Promise<SpeakResult> {
  stopSpeaking();
  const clean = plainForSpeech(text).slice(0, 1400);
  if (!clean) return "unsupported";
  if (opts.server) {
    try {
      const { data } = await api.post<Blob>("/copilot/speak", { text: clean, language }, { responseType: "blob" });
      const audio = new Audio(URL.createObjectURL(data));
      stopCurrent = () => { audio.pause(); URL.revokeObjectURL(audio.src); };
      audio.onended = () => { opts.onEnd?.(); URL.revokeObjectURL(audio.src); };
      await audio.play();
      return "server";
    } catch {
      /* fall back to the device's own voices */
    }
  }
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return "unsupported";
  const tag = speechTag(language);
  const voices = await voicesReady();
  const voice = voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2).toLowerCase()));
  if (!voice && tag.slice(0, 2) !== "en") return "no-voice";
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = tag;
  if (voice) u.voice = voice;
  u.onend = () => opts.onEnd?.();
  speechSynthesis.speak(u);
  return "browser";
}

/** Best guess at the language of typed text, from its script (used to pick a voice for the reply). */
export function guessLanguage(text: string, fallback: string): string {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return fallback;
  const share = (re: RegExp) => (letters.match(re)?.length ?? 0) / letters.length;
  if (share(/[\u0600-\u06FF]/g) > 0.3) return "Arabic";
  if (share(/[\u0900-\u097F]/g) > 0.3) return "Hindi";
  if (share(/[\u0B80-\u0BFF]/g) > 0.3) return "Tamil";
  if (share(/[A-Za-z]/g) > 0.6) return "English";
  return fallback;
}
