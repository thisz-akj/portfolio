"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallView } from "./api";

export type Line = "clinic" | "about";
export type Phase = "idle" | "connecting" | "speaking" | "listening" | "hearing" | "thinking" | "ended";

export interface Msg {
  id: string;
  role: "caller" | "agent";
  text: string;
}

/** One turn's timing in ms: from the moment the agent decided you'd finished to its first sound. */
export interface TurnTiming {
  stt: number | null;
  agent: number;
  total: number;
}

const SESSION_API = "/api/demos/voice-ai/session";
const VIEW_TOPIC = "vx.view";

/**
 * A live call over LiveKit: the browser publishes the mic and plays the agent's audio; the agent (voice/agent)
 * does speech detection, end-of-turn, transcription, the reply and the voice. Transcripts arrive on the
 * "lk.transcription" text stream, the clinic panels on "vx.view", the agent's state as a participant attribute.
 */
export function useVoiceCall(line: Line) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [view, setView] = useState<CallView | null>(null);
  const [timings, setTimings] = useState<TurnTiming[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [limit, setLimit] = useState<"calls" | "questions" | "turns" | null>(null);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioEls = useRef<HTMLMediaElement[]>([]);
  const thinkingAt = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const limitAfter = useRef<"questions" | "turns" | null>(null); // show once the agent has finished speaking

  const upsert = useCallback((id: string, role: Msg["role"], text: string, append: boolean) => {
    setMessages((m) => {
      const i = m.findIndex((x) => x.id === id);
      if (i < 0) return [...m, { id, role, text }];
      const next = m.slice();
      next[i] = { ...next[i], text: append ? next[i].text + text : text };
      return next;
    });
  }, []);

  const flushLimit = useCallback(() => {
    if (limitAfter.current) setLimit(limitAfter.current);
    limitAfter.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioEls.current.forEach((el) => el.remove());
    audioEls.current = [];
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    setMicOn(false);
  }, []);

  const end = useCallback(() => {
    cleanup();
    setPhase("ended");
    flushLimit();
  }, [cleanup, flushLimit]);

  const start = useCallback(async () => {
    setNotice(null);
    setMessages([]);
    setTimings([]);
    setView(null);
    limitAfter.current = null;
    setPhase("connecting");

    const res = await fetch(SESSION_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ line }) }).catch(() => null);
    if (!res || !res.ok) {
      const body = (await res?.json().catch(() => null)) as { detail?: { code?: string; message?: string } } | null;
      if (body?.detail?.code === "turns") setLimit("turns");
      else if (body?.detail?.code === "quota") setLimit("calls");
      else setNotice(body?.detail?.message ?? "Couldn't start the call. Please try again.");
      setPhase("idle");
      return;
    }
    const { url, token } = (await res.json()) as { url: string; token: string };
    const { Room, RoomEvent, Track } = await import("livekit-client");
    const room = new Room({ adaptiveStream: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.style.display = "none";
      document.body.appendChild(el);
      audioEls.current.push(el);
    });
    room.on(RoomEvent.ParticipantAttributesChanged, (changed) => {
      const state = changed["lk.agent.state"];
      if (!state) return;
      if (state === "thinking") {
        thinkingAt.current = performance.now();
        setPhase("thinking");
      } else if (state === "speaking") {
        if (thinkingAt.current !== null) {
          const total = Math.round(performance.now() - thinkingAt.current);
          setTimings((t) => [...t, { stt: null, agent: total, total }]);
          thinkingAt.current = null;
        }
        setPhase("speaking");
      } else if (state === "listening") {
        setPhase((p) => (p === "ended" ? p : "listening"));
        flushLimit();
      }
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      if (speakers.some((p) => p.isLocal)) setPhase((p) => (p === "listening" ? "hearing" : p));
    });
    room.on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
      if (topic !== VIEW_TOPIC) return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as { type: string; view?: CallView; kind?: string; after?: boolean };
        if (msg.type === "view" && msg.view) setView(msg.view);
        else if (msg.type === "limit") limitAfter.current = msg.kind === "turns" ? "turns" : "questions";
        else if (msg.type === "ended") end();
      } catch {
        /* ignore */
      }
    });
    // One message per utterance. Drafts and the final transcript usually share "lk.segment_id", but not always
    // (real mics split speech differently), so while the caller's draft is on screen the next caller stream
    // replaces it rather than adding a line; a final identical to the previous line is dropped. The agent's own
    // streams are keyed by segment only (its sentences stream as drafts, one segment per reply).
    let pendingCaller: string | null = null; // the caller's draft still on screen
    room.registerTextStreamHandler("lk.transcription", async (reader, participant) => {
      const role: Msg["role"] = participant.identity === room.localParticipant.identity ? "caller" : "agent";
      const attrs = reader.info.attributes ?? {};
      const isFinal = attrs["lk.transcription_final"] === "true";
      const segment = attrs["lk.segment_id"] ?? reader.info.id;
      let id = segment;
      if (role === "caller") {
        id = pendingCaller ?? segment;
        pendingCaller = isFinal ? null : id;
      }
      let text = "";
      for await (const chunk of reader) {
        text += chunk;
        upsert(id, role, text, false);
      }
      if (isFinal)
        setMessages((m) => {
          const i = m.findIndex((x) => x.id === id);
          const prev = [...m.slice(0, Math.max(0, i))].reverse().find((x) => x.role === role);
          return i > 0 && prev && prev.text.trim() === m[i].text.trim() ? m.filter((x) => x.id !== id) : m;
        });
    });
    room.on(RoomEvent.Disconnected, () => {
      cleanup();
      setPhase("ended");
      flushLimit();
    });

    try {
      await room.connect(url, token);
    } catch {
      setNotice("Couldn't connect the call. Please try again.");
      cleanup();
      setPhase("idle");
      return;
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setMicOn(true);
    } catch {
      setNotice("Microphone is off or blocked. You can still type to the agent.");
    }
    setPhase("listening");

    // level meter: your voice while you talk, the agent's while it speaks
    const tick = () => {
      const r = roomRef.current;
      if (!r) return;
      const agentLevel = Math.max(0, ...[...r.remoteParticipants.values()].map((p) => p.audioLevel));
      const lvl = Math.max(r.localParticipant.audioLevel, agentLevel);
      meterRef.current?.style.setProperty("--lvl", Math.min(1, lvl * 3).toFixed(3));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [cleanup, end, flushLimit, line, upsert]);

  const type = useCallback(
    async (text: string) => {
      const t = text.trim();
      const room = roomRef.current;
      if (!t || !room) return;
      upsert(`typed-${Date.now()}`, "caller", t, false);
      await room.localParticipant.sendText(t, { topic: "lk.chat" });
    },
    [upsert],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  return { phase, messages, view, timings, notice, micOn, limit, closeLimit: () => setLimit(null), meterRef, start, end, type };
}
