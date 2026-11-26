/**
 * Spoken output: turn answer text into something worth saying out loud, cut streamed text into sentences so
 * the first one can be spoken while the rest is still arriving, and queue them on the device's voice.
 */

/** Markdown, links, page paths and routing tags → plain words. */
export function speakable(text: string): string {
  return text
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(^|[\s(])\/[a-z0-9][a-z0-9\-/]*/gi, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/^\s*(?:[-•*]|\d+\.)\s+/gm, "")
    .replace(/[*_`#>~|]/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Owner rule: answers say "Azad"/"Azad's", never he/she. The model sometimes slips, so on this line (where every
 * answer is about Azad) third-person pronouns are rewritten before anything is shown or spoken.
 */
export function neutral(text: string, name = "Azad"): string {
  const cap = (w: string, r: string) => (w[0] === w[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r);
  return text
    .replace(/\b(himself|herself)\b/gi, name)
    .replace(/\b(his|her)\b(?=\s+[a-z])/gi, () => `${name}'s`)
    .replace(/\b(he|she|him|her)\b/gi, (w) => cap(w, name));
}

const ABBREVIATIONS = /\b(?:Dr|Mr|Mrs|Ms|St|vs|etc|e\.g|i\.e|approx|No)\.$/i;

/**
 * Splits complete sentences off the front of `buffer`. A sentence ends at . ! or ? followed by a space (so a
 * streamed "4." or "Dr." waits for more text). Very short pieces are joined to the next one.
 */
export function takeSentences(buffer: string, minChars = 24): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let start = 0;
  const re = /[.!?]+(?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buffer))) {
    const end = m.index + m[0].length;
    const piece = buffer.slice(start, end).trim();
    if (ABBREVIATIONS.test(piece) || /\d\.$/.test(piece) && /^\s*\d/.test(buffer.slice(end))) continue;
    if (piece.length < minChars) continue;
    sentences.push(piece);
    start = end;
  }
  return { sentences, rest: buffer.slice(start).trimStart() };
}

/** English voices on this device, best first: natural/neural and Indian English voices lead. */
export function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang === "en-IN" ? 3 : v.lang === "en-GB" ? 1 : 0) +
    (/natural|neural|online|premium|enhanced/i.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (v.localService ? 0 : 1);
  return voices.filter((v) => v.lang.toLowerCase().startsWith("en")).sort((a, b) => score(b) - score(a));
}

export const pickVoice = (voices: SpeechSynthesisVoice[]) => rankVoices(voices)[0];

/** Queue of sentences on speechSynthesis. `onStart` fires on the first audio of a reply, `onIdle` once it's all said. */
export class Speaker {
  private queue: string[] = [];
  private current: SpeechSynthesisUtterance | null = null; // keep a reference: Chrome drops events of collected utterances
  private open = false;
  private started = false;
  private voice: SpeechSynthesisVoice | undefined;
  speaking = false;
  onStart: () => void = () => {};
  onIdle: () => void = () => {};

  /** `alt`: a different voice from the default one (sample calls use it for the caller). */
  constructor(private opts: { alt?: boolean; pitch?: number } = {}) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const ranked = rankVoices(window.speechSynthesis.getVoices());
      this.voice = (opts.alt && ranked[1]) || ranked[0];
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
  }

  static supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Start a reply; sentences can then be added as they stream in, and `close()` marks the end. */
  begin() {
    this.cancel();
    this.open = true;
    this.started = false;
  }

  say(text: string) {
    const t = speakable(text);
    if (!t) return;
    this.queue.push(t);
    if (!this.speaking) this.next();
  }

  close() {
    this.open = false;
    if (!this.speaking && this.queue.length === 0) this.finish();
  }

  cancel() {
    this.queue = [];
    this.open = false;
    this.speaking = false;
    this.current = null;
    if (Speaker.supported()) window.speechSynthesis.cancel();
  }

  private finish() {
    this.speaking = false;
    this.onIdle();
  }

  private next() {
    const text = this.queue.shift();
    if (text === undefined) {
      if (!this.open) this.finish();
      else this.speaking = false;
      return;
    }
    if (!Speaker.supported()) {
      this.next();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? "en-IN";
    u.rate = 1.04;
    u.pitch = this.opts.pitch ?? 1;
    u.onstart = () => {
      if (!this.started) {
        this.started = true;
        this.onStart();
      }
    };
    u.onend = u.onerror = () => {
      if (this.current === u) this.next();
    };
    this.current = u;
    this.speaking = true;
    window.speechSynthesis.speak(u);
  }
}
