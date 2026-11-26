"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Mic, MicOff, Phone, PhoneOff, Play, Send, Square } from "lucide-react";
import { AiLimitDialog } from "@/components/shared/AiLimitDialog";
import { openLiveDemo } from "@/lib/liveDemo";
import { VOICE_API, type SlotView } from "./api";
import { voiceCopy as c } from "./copy";
import quality from "./quality.json";
import { SAMPLES, useSamplePlayer } from "./useSamplePlayer";
import { useVoiceCall, type Line, type Phase, type TurnTiming } from "./useVoiceCall";
import { HomeLink } from "@/components/shared/HomeLink";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const msOrS = (ms: number) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : secs(ms));

function Delay({ timings }: { timings: TurnTiming[] }) {
  if (!timings.length) return null;
  const last = timings[timings.length - 1];
  const avg = timings.reduce((n, t) => n + t.total, 0) / timings.length;
  return (
    <p className="vx-delay" title={c.delay.note}>
      {c.delay.label} <strong>{secs(last.total)}</strong>
      {timings.length > 1 && (
        <span>
          {" "}
          · {c.delay.avg} {secs(avg)}
        </span>
      )}
    </p>
  );
}

function Timer({ running }: { running: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    setT(0);
    const id = setInterval(() => setT(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!running && t === 0) return null;
  return (
    <span className="vx-timer">
      {Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}
    </span>
  );
}

/** What a tap on an offered slot says, in words the agent reads unambiguously. */
const pickText = (s: SlotView, all: SlotView[]) => {
  const [, day, month, hhmm] = s.label.split(" "); // "Wed 25 Nov 10:00"
  const sameDay = all.every((x) => x.start.slice(0, 10) === s.start.slice(0, 10));
  return sameDay ? `${hhmm} please` : `${day} ${month} at ${hhmm}`;
};

function Quality() {
  const q = quality as typeof quality & { ranAt?: string };
  if (!q.calls) return null;
  return (
    <div className="vx-card vx-quality">
      <h2>{c.quality.heading}</h2>
      <dl>
        <div>
          <dt>
            {q.calls.passed}/{q.calls.total}
          </dt>
          <dd>{c.quality.calls}</dd>
        </div>
        {q.heard && (
          <div>
            <dt>{Math.round(q.heard.understood * 100)}%</dt>
            <dd>
              {c.quality.heard} ({q.heard.clips}; {c.quality.heardNote})
            </dd>
          </div>
        )}
        {q.sttMs && (
          <div>
            <dt>{secs(q.sttMs)}</dt>
            <dd>{c.quality.stt}</dd>
          </div>
        )}
        {q.turnMs && (
          <div>
            <dt>{msOrS(q.turnMs.quick)}</dt>
            <dd>
              {c.quality.quick}
              {q.turnMs.harder ? ` · ${secs(q.turnMs.harder)} ${c.quality.harder}` : ""}
            </dd>
          </div>
        )}
        {q.aboutFirstWordMs && (
          <div>
            <dt>{secs(q.aboutFirstWordMs)}</dt>
            <dd>{c.quality.about}</dd>
          </div>
        )}
      </dl>
      <p className="vx-fine">{c.quality.note}</p>
    </div>
  );
}

export function VoiceApp() {
  const [line, setLine] = useState<Line>("clinic");
  const call = useVoiceCall(line);
  const player = useSamplePlayer();
  const [draft, setDraft] = useState("");
  const [offline, setOffline] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const live = !["idle", "ended"].includes(call.phase);
  const playing = player.sample !== null;
  const copy = c.lines[line];

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("line") === "about") setLine("about"); // deep link from the showcase
    fetch(`${VOICE_API}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((h: { ok?: boolean } | null) => setOffline(!h?.ok))
      .catch(() => setOffline(true));
  }, []);

  const messages = playing ? (player.view?.messages ?? []) : call.messages;
  const lastText = messages[messages.length - 1]?.text;
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastText]);

  const send = (text: string) => {
    void call.type(text);
    setDraft("");
  };

  const phase: Phase | "caller" = playing ? (player.talking === "caller" ? "caller" : player.talking === "agent" ? "speaking" : player.done ? "ended" : "listening") : call.phase;
  const events = playing ? (player.view?.events ?? []) : (call.view?.events ?? []);
  const booking = playing ? (player.view?.booking ?? null) : (call.view?.booking ?? null);
  const note = playing ? player.view?.summary : call.view && (call.view.ended || call.phase === "ended") ? call.view.summary.text : null;
  const offered = !playing && line === "clinic" && live ? (call.view?.offered ?? []) : [];

  return (
    <div className="vx">
      <header className="vx-top">
        <HomeLink />
        <Link href="/demos/voice-ai" className="vx-back">
          <ArrowLeft size={14} /> About this demo
        </Link>
        <span className="vx-brand">
          <span className="vx-brand-mark" aria-hidden="true" />
          {c.title}
        </span>
        <span className="vx-badge">{c.badge}</span>
      </header>

      <div className="vx-body">
        <section className="vx-phone" aria-label="Call">
          <div className="vx-tabs" role="tablist">
            {(Object.keys(c.lines) as Line[]).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={line === l}
                disabled={live || playing}
                className="vx-tab"
                onClick={() => setLine(l)}
              >
                {c.lines[l].tab}
              </button>
            ))}
          </div>
          <p className="vx-blurb">{playing ? `${c.samples.playingLabel}: ${player.sample?.title}` : copy.blurb}</p>

          <div className="vx-orb" data-phase={phase} ref={call.meterRef} aria-live="polite">
            <span className="vx-orb-ring" aria-hidden="true" />
            <span className="vx-orb-ring vx-orb-ring--outer" aria-hidden="true" />
            <span className="vx-orb-core" aria-hidden="true">
              {playing ? <Play size={22} /> : call.micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </span>
            <span className="vx-orb-label">
              {c.phase[phase]} <Timer running={live} />
            </span>
          </div>

          {playing ? (
            <button className="vx-call vx-call--end" onClick={player.stop}>
              <Square size={14} /> {c.samples.stop}
            </button>
          ) : live ? (
            <button className="vx-call vx-call--end" onClick={call.end}>
              <PhoneOff size={16} /> {c.end}
            </button>
          ) : (
            <button className="vx-call" onClick={() => (offline ? openLiveDemo("Front Desk Voice") : void call.start())}>
              <Phone size={16} /> {call.phase === "ended" ? c.again : copy.start}
            </button>
          )}

          <Delay timings={call.timings} />
          {offline && !live && <p className="vx-notice">{c.offline}</p>}
          {call.notice && !playing && <p className="vx-notice">{call.notice}</p>}

          {offered.length > 0 && (
            <div className="vx-offered">
              <span>{c.offered}</span>
              {offered.map((s) => (
                <button key={s.start} onClick={() => send(pickText(s, offered))} disabled={call.phase === "thinking"}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <form
            className="vx-type"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={c.typePlaceholder} maxLength={400} disabled={!live} aria-label="Type a message" />
            <button type="submit" disabled={!live || !draft.trim()} aria-label="Send">
              <Send size={15} />
            </button>
          </form>
          <p className="vx-fine">
            {c.micHint} {line === "clinic" ? c.freeCalls : c.freeQuestions}
          </p>
        </section>

        <section className="vx-transcript" ref={scroller} aria-label="Transcript">
          {messages.length === 0 ? (
            <div className="vx-try">
              <h2>Try saying</h2>
              <ul>
                {(line === "clinic" ? c.clinic.tryLines : c.about.tryLines).map((t) => (
                  <li key={t}>“{t}”</li>
                ))}
              </ul>
              {line === "clinic" && (
                <div className="vx-samples">
                  <h3>{c.samples.heading}</h3>
                  <p className="vx-fine">{c.samples.note}</p>
                  <ul>
                    {SAMPLES.map((s) => (
                      <li key={s.id}>
                        <button onClick={() => void player.play(s)} disabled={live}>
                          <Play size={13} />
                          <span>
                            <strong>{s.title}</strong>
                            {s.blurb}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            messages.map((m) => (
              <p key={m.id} className={`vx-msg vx-msg--${m.role}`}>
                <span className="vx-who">
                  {m.role === "agent" ? (line === "clinic" ? "Front desk" : "Assistant") : playing ? c.samples.caller : "You"}
                </span>
                {m.text || "…"}
              </p>
            ))
          )}
          {!playing && live && line === "about" && call.messages.length > 0 && (
            <div className="vx-chips">
              {c.about.tryLines.map((t) => (
                <button key={t} onClick={() => send(t)} disabled={call.phase === "thinking"}>
                  {t}
                </button>
              ))}
            </div>
          )}
          {!live && !playing && messages.length > 0 && line === "clinic" && (
            <div className="vx-chips">
              {SAMPLES.slice(0, 3).map((s) => (
                <button key={s.id} onClick={() => void player.play(s)}>
                  <Play size={11} /> {s.title}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="vx-side">
          {line === "clinic" ? (
            <>
              <div className="vx-card">
                <h2>{c.clinic.booking}</h2>
                {booking ? (
                  <p className="vx-booked">
                    <CalendarCheck size={16} /> {booking.doctor}
                    <br />
                    <strong>{booking.label}</strong>
                    {!playing && call.view?.summary.patient && <span> · {call.view.summary.patient}</span>}
                  </p>
                ) : (
                  <p className="vx-muted">{c.clinic.noBooking}</p>
                )}
              </div>
              <div className="vx-card">
                <h2>{events.length ? c.clinic.timeline : "Doctors"}</h2>
                {events.length ? (
                  <ol className="vx-events">
                    {events.map((e, i) => (
                      <li key={i} data-kind={e.kind}>
                        {e.text}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="vx-doctors">
                    {c.clinic.doctors.map(([name, what, days]) => (
                      <li key={name}>
                        <strong>{name}</strong> {what} · {days}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {note && (
                <div className="vx-card vx-card--note">
                  <h2>{c.clinic.summary}</h2>
                  <p>{note}</p>
                </div>
              )}
              <Quality />
            </>
          ) : (
            <>
              <div className="vx-card">
                <h2>Ask about</h2>
                <ul className="vx-doctors">
                  <li>Projects and the results they delivered</li>
                  <li>AI automation, document and voice work</li>
                  <li>Working together and getting in touch</li>
                </ul>
              </div>
              <Quality />
            </>
          )}
        </aside>
      </div>

      <AiLimitDialog
        open={call.limit !== null}
        onClose={call.closeLimit}
        message={call.limit === "turns" ? c.limit.turns.body : call.limit === "calls" ? c.limit.calls : undefined}
        copy={call.limit === "turns" ? c.limit.turns : undefined}
      />
    </div>
  );
}
