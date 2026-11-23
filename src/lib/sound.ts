"use client";

/**
 * Procedural sound design — everything is synthesised with the Web Audio API.
 * No audio files, no licensing, tiny footprint.
 *
 *  - ambient(): a slow, warm pad (soft detuned sines through a low-pass filter,
 *    chords drifting every ~14 s) plus a whisper of filtered "air". Very quiet.
 *  - hover() / tap(): soft, short, slightly pitched ticks for useful targets.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily and resumed on the first pointerdown / keydown (see SoundProvider).
 * The on/off choice is remembered per visitor (localStorage, best effort).
 */

type Listener = (on: boolean) => void;

const PREF_KEY = "sound-pref";
const MASTER = 1.75; // ~+6 dB over the original 0.9 (louder effects)
const AMBIENT_LEVEL = 0.026; // compensates MASTER so the pad stays at its original loudness (0.05 × 0.9 ÷ 1.75)

// A calm, unresolved progression (A minor 9 → F maj7 → C add9 → G sus2), low register.
const CHORDS = [
  [110.0, 164.81, 196.0, 246.94, 329.63],
  [87.31, 130.81, 174.61, 220.0, 329.63],
  [65.41, 130.81, 196.0, 246.94, 293.66],
  [98.0, 146.83, 196.0, 220.0, 293.66],
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambientBus: GainNode | null = null;
  private ambientTimer = 0;
  private chordIdx = 0;
  private voices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private lastHover = 0;
  private listeners = new Set<Listener>();

  enabled = true; // preference
  unlocked = false; // a user gesture has happened

  constructor() {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(PREF_KEY);
      if (v === "off") this.enabled = false;
    } catch {
      /* storage unavailable — default on */
    }
  }

  get active() {
    return this.enabled && this.unlocked && !!this.ctx;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((f) => f(this.enabled));
  }

  private ensureContext() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? MASTER : 0;
    // gentle limiter so nothing ever spikes
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.noise = this.makeNoise();
  }

  /** Call from a user gesture. Creates/resumes the context and starts ambience. */
  unlock() {
    if (typeof window === "undefined") return;
    this.ensureContext();
    if (!this.ctx) return;
    this.ctx.resume().catch(() => {});
    if (!this.unlocked) {
      this.unlocked = true;
      this.emit();
    }
    if (this.enabled) this.startAmbient();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? MASTER : 0, t, 0.25);
      if (on) this.startAmbient();
      else window.setTimeout(() => !this.enabled && this.stopAmbient(), 1200);
    }
    this.emit();
  }

  /** Fade everything while the tab is hidden; restore on return. */
  setVisible(visible: boolean) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(visible && this.enabled ? MASTER : 0, t, 0.4);
  }

  // ───────────────────────── ambience ─────────────────────────
  private startAmbient() {
    if (!this.ctx || !this.master || this.ambientBus) return;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(AMBIENT_LEVEL, ctx.currentTime, 3); // slow fade-in

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.3;
    // breathing filter
    const lfo = ctx.createOscillator();
    const lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoAmt.gain.value = 350;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();

    // soft air: very quiet low-passed noise
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airLp = ctx.createBiquadFilter();
    airLp.type = "lowpass";
    airLp.frequency.value = 500;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.05;
    air.connect(airLp).connect(airGain).connect(bus);
    air.start();

    lp.connect(bus);
    bus.connect(this.master);
    this.ambientBus = bus;
    (bus as GainNode & { _lp?: BiquadFilterNode })._lp = lp;
    this.playChord(true);
    this.ambientTimer = window.setInterval(() => this.playChord(false), 14000);
  }

  private playChord(first: boolean) {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const lp = (this.ambientBus as GainNode & { _lp?: BiquadFilterNode })._lp!;
    const t = ctx.currentTime;
    // fade out previous voices
    this.voices.forEach((v) => {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 2.5);
      v.osc.forEach((o) => o.stop(t + 10));
    });
    this.voices = [];
    const notes = CHORDS[this.chordIdx % CHORDS.length];
    this.chordIdx++;
    notes.forEach((f, i) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(i === 0 ? 0.22 : 0.12, t, first ? 3 : 2.5);
      const oscs = [-4, 4].map((cents) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = cents + (Math.random() - 0.5) * 3;
        o.connect(g);
        o.start(t);
        return o;
      });
      g.connect(lp);
      this.voices.push({ osc: oscs, gain: g });
    });
  }

  private stopAmbient() {
    window.clearInterval(this.ambientTimer);
    if (!this.ctx || !this.ambientBus) return;
    const t = this.ctx.currentTime;
    this.ambientBus.gain.setTargetAtTime(0, t, 0.6);
    this.voices.forEach((v) => v.osc.forEach((o) => o.stop(t + 4)));
    this.voices = [];
    const bus = this.ambientBus;
    this.ambientBus = null;
    window.setTimeout(() => bus.disconnect(), 4500);
  }

  // ───────────────────────── cloth / paper rub ─────────────────────────
  private rubSrc: AudioBufferSourceNode | null = null;
  private rubGain: GainNode | null = null;
  private rubFilter: BiquadFilterNode | null = null;
  private rubIdle = 0;

  /** speed 0..1 — call on pointer moves over a mesh; it decays by itself. */
  rub(speed: number) {
    if (!this.active || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (!this.rubSrc) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = 0.6; // slower = softer, more fabric-like grain
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(bp).connect(lp).connect(g).connect(this.master);
      src.start();
      this.rubSrc = src;
      this.rubGain = g;
      this.rubFilter = bp;
    }
    const t = ctx.currentTime;
    const lvl = Math.min(1, speed);
    this.rubGain!.gain.cancelScheduledValues(t);
    this.rubGain!.gain.setTargetAtTime(0.01 + lvl * 0.055, t, 0.04);
    this.rubGain!.gain.setTargetAtTime(0, t + 0.09, 0.14); // lifts when the hand stops
    this.rubFilter!.frequency.setTargetAtTime(600 + lvl * 1100 + Math.random() * 200, t, 0.06);
    window.clearTimeout(this.rubIdle);
    this.rubIdle = window.setTimeout(() => {
      this.rubSrc?.stop();
      this.rubSrc = null;
      this.rubGain = null;
      this.rubFilter = null;
    }, 1500);
  }

  // ───────────────────────── bulb flicker ─────────────────────────
  /** Electrical buzz + filament ticks, gated on/off like a failing bulb, for `ms`. */
  flicker(ms = 800) {
    if (!this.active || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const end = t0 + ms / 1000;

    // mains hum (100 Hz + harmonics) through a band-pass → buzzy, not musical
    const hum = ctx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 100;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1300;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = 0;
    hum.connect(bp).connect(g).connect(this.master);

    let t = t0;
    while (t < end) {
      const on = 0.025 + Math.random() * 0.09;
      const off = 0.015 + Math.random() * 0.08;
      const lvl = 0.02 + Math.random() * 0.03;
      g.gain.setValueAtTime(lvl, t);
      g.gain.setValueAtTime(0, Math.min(end, t + on));
      this.tick(t, 0.03 + Math.random() * 0.03); // filament click on each strike
      t += on + off;
    }
    g.gain.setValueAtTime(0, end);
    hum.start(t0);
    hum.stop(end + 0.05);
  }

  private tick(at: number, level: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.018);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(at, Math.random());
    src.stop(at + 0.03);
  }

  // ───────────────────────── UI ticks ─────────────────────────
  /** Soft woody tick for hovering useful targets. */
  hover(pitch = 1) {
    if (!this.active || !this.ctx || !this.master) return;
    const now = performance.now();
    if (now - this.lastHover < 70) return; // never chatter
    this.lastHover = now;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    o.type = "sine";
    const f = 880 * pitch * (0.98 + Math.random() * 0.04);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.027, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  /** Slightly fuller, lower "pop" for clicks / opening things. */
  tap() {
    if (!this.active || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [523.25, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t + i * 0.035);
      g.gain.setValueAtTime(0, t + i * 0.035);
      g.gain.linearRampToValueAtTime(0.03, t + i * 0.035 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.035 + 0.22);
      o.connect(g).connect(this.master!);
      o.start(t + i * 0.035);
      o.stop(t + i * 0.035 + 0.25);
    });
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // pinkish noise (Paul Kellet's economical filter)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    return buf;
  }
}

let engine: SoundEngine | null = null;
export function sound(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}
