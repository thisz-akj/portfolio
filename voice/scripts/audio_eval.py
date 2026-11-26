"""How well callers are heard: synthetic recordings → speech-to-text → the same fields the agent reads.

For each line × voice × condition (clean, background noise, phone line) a clip is synthesised locally (ffmpeg
flite, no tokens), transcribed with the live speech-to-text (free tier, paced), and both the reference text and
the transcript are read by the agent's rules. "Understood the same" = identical fields (doctor, day, time, name,
intent …). Also word error rate and speech-to-text time. Optional: first-word time of the "Ask about Azad" line.

  env -u PYTHONPATH .venv/bin/python -m scripts.audio_eval [--assistant]   → quality/audio.json
Synthetic voices are a stand-in for real callers (no human accents); the report says so.
"""

from __future__ import annotations

import argparse
import hashlib
import asyncio
import json
import re
import subprocess
import time
from datetime import datetime
from pathlib import Path

import httpx

from app.clinic import Slot, TZ
from app.config import ROOT, get_settings
from app.nlu import Context, rules
from app.scenarios import NOW
from app.stt import GroqTranscriber, SttBusy
from scripts.evaluate import pct

AUDIO = ROOT / "quality" / ".audio"
VOICES = ("slt", "rms", "awb")  # US female, US male, Scottish male
CONDITIONS = {
    "clean": None,
    "noise": "[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.6",
    "phone": "highpass=f=300,lowpass=f=3400,aresample=8000,aresample=16000",
}
LINES: list[tuple[str, str]] = [  # (what the caller says, what the agent had just asked)
    ("Hi, I need to see Doctor Rao for a follow up, ideally Tuesday afternoon. It's Arjun Mehta.", "open"),
    ("Can I book Doctor Iyer on Friday morning? My name is Fatima Sheikh.", "open"),
    ("My son has a fever, can he see the children's doctor on Thursday?", "open"),
    ("I'd like the earliest slot with the dentist, Doctor Qureshi.", "open"),
    ("The second one please.", "offer"),
    ("Actually, can we make it Wednesday at half past eleven instead?", "offer"),
    ("What time does the clinic open on Saturday?", "open"),
    ("Is there parking near the clinic?", "open"),
    ("I need to cancel my appointment, it's Vikram Singh.", "open"),
    ("Can I speak to someone at the front desk please?", "open"),
    ("My father has chest pain and is sweating.", "open"),
    ("Doctor Menon on Tuesday at four, for my daughter Ananya.", "open"),
]
ABOUT_QUESTIONS = ["What kind of work does Azad do?", "Has Azad built anything with documents?",
                   "Which clients has Azad worked with?", "How do I get in touch with Azad?"]


def synth(text: str, voice: str, condition: str) -> Path:
    AUDIO.mkdir(parents=True, exist_ok=True)
    out = AUDIO / f"{hashlib.sha1(text.encode()).hexdigest()[:10]}-{voice}-{condition}.wav"
    if out.exists():
        return out
    safe = text.replace("'", "").replace(":", " ")
    src = ["-f", "lavfi", "-i", f"flite=text='{safe}':voice={voice}"]
    if condition == "noise":
        cmd = ["ffmpeg", "-y", *src, "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.04:seed=7",
               "-filter_complex", CONDITIONS["noise"]]
    elif condition == "phone":
        cmd = ["ffmpeg", "-y", *src, "-af", CONDITIONS["phone"]]
    else:
        cmd = ["ffmpeg", "-y", *src]
    subprocess.run([*cmd, "-ar", "16000", "-ac", "1", str(out)], check=True, capture_output=True)
    return out


def words(t: str) -> list[str]:
    t = t.lower().replace("dr.", "doctor").replace("dr ", "doctor ").replace("-", " ")
    return re.findall(r"[a-z0-9']+", t)


def wer(ref: str, hyp: str) -> float:
    r, h = words(ref), words(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


def fields(text: str, ctx: Context) -> tuple:
    u = rules(text, ctx)
    return (u.intent, u.yes, u.no, u.choice, u.doctor_id, u.specialty, u.day, u.at, u.part, u.earliest, u.topic,
            (u.name or "").lower())


def same(a: tuple, b: tuple) -> bool:
    """Same fields; names count as the same if they're spelling variants ("Sheik"/"Sheikh"), ≥ 85% similar."""
    from difflib import SequenceMatcher
    if a[:-1] != b[:-1]:
        return False
    if not a[-1] or not b[-1]:
        return a[-1] == b[-1]
    return SequenceMatcher(None, a[-1], b[-1]).ratio() >= 0.85


async def assistant_ttft(base: str) -> list[float]:
    out = []
    async with httpx.AsyncClient(timeout=30) as client:
        for q in ABOUT_QUESTIONS:
            t0 = time.perf_counter()
            first = None
            async with client.stream("POST", f"{base}/chat", json={"messages": [{"role": "user", "content": q}],
                                                                     "channel": "voice"}) as r:
                async for line in r.aiter_lines():
                    if line and json.loads(line).get("type") == "delta" and first is None:
                        first = (time.perf_counter() - t0) * 1000
            if first is not None:
                out.append(first)
            await asyncio.sleep(4)
    return out


def previous_ttft() -> dict | None:
    p = ROOT / "quality" / "audio.json"
    return json.loads(p.read_text()).get("assistantFirstWordMs") if p.exists() else None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assistant", default="", help="assistant base URL to time, e.g. http://127.0.0.1:8001")
    args = ap.parse_args()
    settings = get_settings()
    stt = GroqTranscriber(settings)
    now = datetime.fromisoformat(NOW)
    offered = [Slot("rao", datetime(2026, 11, 25, 10, 0, tzinfo=TZ)), Slot("rao", datetime(2026, 11, 25, 11, 30, tzinfo=TZ))]
    rows = []
    for text, asked in LINES:
        ctx = Context(asked, offered if asked == "offer" else [], now.date())
        want = fields(text, ctx)
        for voice in VOICES:
            for cond in CONDITIONS:
                path = synth(text, voice, cond)
                t0 = time.perf_counter()
                try:
                    hyp, _ = await stt.transcribe(path.read_bytes(), path.name, "clinic")
                except SttBusy as err:
                    print("busy", err)
                    await asyncio.sleep(20)
                    continue
                ms = (time.perf_counter() - t0) * 1000
                ok = same(fields(hyp, ctx), want)
                rows.append({"line": text, "voice": voice, "condition": cond, "heard": hyp, "wer": round(wer(text, hyp), 3),
                             "same": ok, "ms": round(ms)})
                print("OK  " if ok else "DIFF", voice, cond, "|", hyp)
                await asyncio.sleep(3.2)  # free tier: stay under the per-minute request limit
    by = lambda key: {k: {"n": len(v), "understood": round(sum(r["same"] for r in v) / len(v), 3),  # noqa: E731
                          "wer": round(sum(r["wer"] for r in v) / len(v), 3)}
                      for k in {r[key] for r in rows} for v in [[r for r in rows if r[key] == k]]}
    report = {
        "ranAt": datetime.now().isoformat(timespec="seconds"),
        "clips": len(rows),
        "understood": round(sum(r["same"] for r in rows) / max(1, len(rows)), 3),
        "wer": round(sum(r["wer"] for r in rows) / max(1, len(rows)), 3),
        "sttMs": pct([r["ms"] for r in rows]),
        "byCondition": by("condition"),
        "byVoice": by("voice"),
        # Re-runs hit the assistant's answer cache, so keep the first (uncached) timing unless asked to re-measure.
        "assistantFirstWordMs": pct(await assistant_ttft(args.assistant)) if args.assistant else previous_ttft(),
        "note": "Synthetic voices (US female, US male, Scottish male); noise = pink noise; phone = 300-3400 Hz, 8 kHz. Names: spelling variants (>= 0.85 similar) count as the same.",
        "rows": rows,
    }
    (ROOT / "quality" / "audio.json").write_text(json.dumps(report, indent=1) + "\n")
    print(f"understood the same: {report['understood']:.0%} of {len(rows)} clips · WER {report['wer']:.1%} · "
          f"stt p50 {report['sttMs'].get('p50')} ms")


if __name__ == "__main__":
    asyncio.run(main())
