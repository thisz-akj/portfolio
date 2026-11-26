"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import data from "./samples.json";
import { Speaker, takeSentences } from "./speech";
import type { CallEvent, SlotView } from "./api";

export interface SampleTurn {
  role: "agent" | "caller";
  text: string;
  events: { kind: string; text: string }[];
  booking: SlotView | null;
}
export interface Sample {
  id: string;
  title: string;
  blurb: string;
  turns: SampleTurn[];
  summary: { outcome: string; text: string };
}

export const SAMPLES = data.samples as Sample[];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readMs = (text: string) => Math.min(6000, 900 + text.split(/\s+/).length * 330);

/** Plays a recorded sample call: both sides spoken on the device (two voices), panels updated turn by turn. 0 tokens. */
export function useSamplePlayer() {
  const [sample, setSample] = useState<Sample | null>(null);
  const [step, setStep] = useState(0);
  const [talking, setTalking] = useState<"agent" | "caller" | null>(null);
  const [done, setDone] = useState(false);
  const token = useRef(0);
  const voices = useRef<{ agent: Speaker; caller: Speaker } | null>(null);

  const speak = useCallback((role: "agent" | "caller", text: string) => {
    voices.current ??= { agent: new Speaker(), caller: new Speaker({ alt: true, pitch: 1.08 }) };
    const sp = voices.current[role];
    if (!Speaker.supported()) return sleep(readMs(text));
    return new Promise<void>((resolve) => {
      const guard = setTimeout(resolve, readMs(text) * 3); // some browsers drop the end event
      sp.onStart = () => {};
      sp.onIdle = () => {
        clearTimeout(guard);
        resolve();
      };
      sp.begin();
      const { sentences, rest } = takeSentences(text + " ");
      sentences.forEach((x) => sp.say(x));
      if (rest.trim()) sp.say(rest);
      sp.close();
    });
  }, []);

  const stop = useCallback(() => {
    token.current++;
    voices.current?.agent.cancel();
    voices.current?.caller.cancel();
    setTalking(null);
    setSample(null);
    setStep(0);
    setDone(false);
  }, []);

  const play = useCallback(
    async (s: Sample) => {
      stop();
      const my = token.current;
      setSample(s);
      for (let i = 0; i < s.turns.length; i++) {
        if (token.current !== my) return;
        const turn = s.turns[i];
        setStep(i + 1);
        setTalking(turn.role);
        await speak(turn.role, turn.text);
        if (token.current !== my) return;
        setTalking(null);
        await sleep(350);
      }
      if (token.current === my) setDone(true);
    },
    [speak, stop],
  );

  useEffect(() => () => stop(), [stop]);

  const view = useMemo(() => {
    if (!sample) return null;
    const shown = sample.turns.slice(0, step);
    return {
      messages: shown.map((t, i) => ({ id: i, role: t.role, text: t.text })),
      events: shown.flatMap((t) => t.events) as Pick<CallEvent, "kind" | "text">[],
      booking: [...shown].reverse().find((t) => t.booking)?.booking ?? null,
      summary: done ? sample.summary.text : null,
    };
  }, [sample, step, done]);

  return { sample, view, talking, done, play, stop };
}
