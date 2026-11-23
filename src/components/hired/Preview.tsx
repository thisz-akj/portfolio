import {
  Bell,
  Bot,
  Check,
  Database,
  FileText,
  Mail,
  Mic,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { PreviewKind } from "@/types/content";

/**
 * Looping mock-UI "product shots" rendered in CSS (see styles/hired.css).
 * They're illustrations, not running software — the panel says so where it matters.
 * All sizes use container-query units, so the same preview works in a hero tile,
 * a bento card or the side panel.
 */
export function Preview({ kind, paused = false }: { kind: PreviewKind; paused?: boolean }) {
  return (
    <div className={`pv pv-${kind} ${paused ? "paused" : ""}`} aria-hidden="true">
      <div className="pv-window">
        <div className="pv-chrome">
          <i />
          <i />
          <i />
          <em>{TITLES[kind]}</em>
        </div>
        <div className="pv-body">{BODIES[kind]}</div>
      </div>
    </div>
  );
}

const TITLES: Record<PreviewKind, string> = {
  flow: "inbox → crm.flow",
  doc: "msa_2026.pdf",
  chat: "support · live",
  voice: "front-desk · call",
  data: "ask your data",
  eval: "eval · run #42",
  cv: "cam-03 · aisle B",
};

const BODIES: Record<PreviewKind, React.ReactNode> = {
  flow: (
    <>
      <div className="flow-nodes">
        {[
          [Mail, "Email"],
          [Sparkles, "Extract"],
          [Database, "CRM"],
          [Bell, "Notify"],
        ].map(([Icon, label], i) => {
          const I = Icon as typeof Mail;
          return (
            <div className="fn" key={label as string} style={{ ["--i" as string]: i }}>
              <I />
              <span>{label as string}</span>
            </div>
          );
        })}
        <div className="flow-wire">
          <b />
        </div>
      </div>
      <ul className="pv-log">
        <li style={{ ["--i" as string]: 0 }}><Check /> lead · Priya S., Northwind</li>
        <li style={{ ["--i" as string]: 1 }}><Check /> deal created · 25 seats</li>
        <li style={{ ["--i" as string]: 2 }}><Check /> reply drafted for review</li>
      </ul>
    </>
  ),
  doc: (
    <div className="doc-split">
      <div className="doc-page">
        <FileText className="doc-ico" />
        {[90, 70, 84, 60, 92, 76, 88, 54, 80, 66].map((w, i) => (
          <span key={i} className={`ln ${i === 3 || i === 7 ? "hl" : ""}`} style={{ width: `${w}%`, ["--i" as string]: i === 7 ? 1 : 0 }} />
        ))}
      </div>
      <div className="doc-json">
        <span className="jk">{"{"}</span>
        {[
          ["notice", '"60 days"'],
          ["renewal", '"auto · 12mo"'],
          ["page", "8"],
          ["grounded", "true"],
        ].map(([k, v], i) => (
          <span className="jrow" key={k} style={{ ["--i" as string]: i }}>
            <span className="jk">&quot;{k}&quot;:</span> <span className="jv">{v}</span>
          </span>
        ))}
        <span className="jk">{"}"}</span>
      </div>
    </div>
  ),
  chat: (
    <div className="chat">
      <div className="bub in" style={{ ["--i" as string]: 0 }}>Charged twice for March?!</div>
      <div className="tags" style={{ ["--i" as string]: 1 }}>
        <span>billing</span>
        <span className="hot">high</span>
      </div>
      <div className="bub out" style={{ ["--i" as string]: 2 }}>
        <Bot /> Sorry about that — refund is on its way in 5–7 days.
      </div>
      <div className="esc" style={{ ["--i" as string]: 3 }}>
        <TriangleAlert /> routed to Billing · draft ready
      </div>
    </div>
  ),
  voice: (
    <div className="voice">
      <div className="mic">
        <Mic />
      </div>
      <div className="wave">
        {Array.from({ length: 28 }, (_, i) => (
          <i key={i} style={{ ["--d" as string]: `${0.5 + ((i * 37) % 9) / 10}s`, ["--h" as string]: `${25 + ((i * 53) % 70)}%` }} />
        ))}
      </div>
      <div className="vt" style={{ ["--i" as string]: 0 }}>“Tuesday afternoon with Dr. Rao?”</div>
      <div className="vcard" style={{ ["--i" as string]: 1 }}>
        <Check /> Booked · Tue 16:15
      </div>
    </div>
  ),
  data: (
    <div className="data">
      <div className="ask">
        <span className="type">Which region dropped most last month?</span>
      </div>
      <div className="bars">
        {[62, 74, 38, 81, 69].map((h, i) => (
          <div key={i} className={`bar ${i === 2 ? "low" : ""}`} style={{ ["--h" as string]: `${h}%`, ["--i" as string]: i }}>
            <span>{["N", "E", "W", "S", "C"][i]}</span>
          </div>
        ))}
      </div>
      <div className="insight">West −18% · 2 stores stocked out</div>
    </div>
  ),
  eval: (
    <div className="evalg">
      {[
        ["prompt v1", 78, "2.1s", false],
        ["v2 + rerank", 88, "2.6s", true],
      ].map(([name, score, lat, win], r) => (
        <div className={`erow ${win ? "win" : ""}`} key={name as string} style={{ ["--i" as string]: r }}>
          <span className="en">{name as string}</span>
          <span className="eb">
            <b style={{ ["--w" as string]: `${score}%` }} />
          </span>
          <span className="es">{score as number}%</span>
          <span className="el">{lat as string}</span>
        </div>
      ))}
      <div className="cells">
        {Array.from({ length: 20 }, (_, i) => {
          const ok = ![3, 9, 14].includes(i);
          return (
            <span key={i} className={ok ? "ok" : "bad"} style={{ ["--i" as string]: i }}>
              {ok ? <Check /> : <X />}
            </span>
          );
        })}
      </div>
    </div>
  ),
  cv: (
    <div className="cv">
      <div className="scan" />
      <div className="box ok" style={{ left: "10%", top: "22%", width: "18%", height: "62%", ["--i" as string]: 0 }}>
        <em>person · ppe ✓</em>
      </div>
      <div className="box ok" style={{ left: "38%", top: "30%", width: "26%", height: "48%", ["--i" as string]: 1 }}>
        <em>forklift</em>
      </div>
      <div className="box bad" style={{ left: "72%", top: "18%", width: "17%", height: "66%", ["--i" as string]: 2 }}>
        <em>no hard hat</em>
      </div>
    </div>
  ),
};
