"""Support-style triage for every answer: topic, route and sources.

Live mode: the model ends its reply with a tag like `[[topic: projects; route: answered]]`, which is
stripped from the stream (TagStripper) and parsed here. Offline mode and missing tags fall back to rules.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

from .corpus import Corpus

TOPICS = ("projects", "services", "demos", "background", "contact", "pricing", "other")
ROUTES = ("answered", "handoff", "off_topic")

TAG = re.compile(r"\[\[\s*topic\s*:\s*([a-z_]+)\s*;\s*route\s*:\s*([a-z_]+)\s*\]\]", re.I)
LINK = re.compile(r"\]\((/[^)\s#?]*)")

TAG_INSTRUCTION = (
    "After your answer, on its own final line, add exactly one routing tag for the support dashboard: "
    "[[topic: <projects|services|demos|background|contact|pricing|other>; route: <answered|handoff|off_topic>]]. "
    "route=answered when the knowledge answered the question; handoff when it isn't on the site or the visitor "
    "needs the site owner personally (pricing, availability, a project enquiry); off_topic when the request is unrelated. "
    "The tag is removed before the visitor sees the reply."
)


@dataclass
class Trace:
    topic: str = "other"
    route: str = "answered"
    sources: list[dict] = field(default_factory=list)
    decided_by: str = "rules"  # "model" when the tag came from the LLM

    def as_event(self, **extra) -> dict:
        """Public trace for the UI. `decided_by` stays server-side (logs only) — no implementation details leave."""
        data = asdict(self)
        data.pop("decided_by")
        return {"type": "trace", **data, **extra}


def topic_for_path(path: str | None) -> str:
    if not path:
        return "other"
    if path.startswith("/work"):
        return "projects"
    if path.startswith("/demos"):
        return "demos"
    if path.startswith("/solutions"):
        return "services"
    if path.startswith("/contact"):
        return "contact"
    return "background"


def sources_in(text: str, corpus: Corpus) -> list[dict]:
    labels = {l.path: l.label for l in corpus.links}
    seen: list[dict] = []
    for path in LINK.findall(text):
        path = path.rstrip("/") or "/"
        if path in labels and all(s["path"] != path for s in seen):
            seen.append({"path": path, "label": labels[path]})
    return seen


def from_model(text: str, tag: str | None, corpus: Corpus) -> Trace:
    sources = sources_in(text, corpus)
    m = TAG.search(tag or "")
    if m and m.group(1).lower() in TOPICS and m.group(2).lower() in ROUTES:
        return Trace(topic=m.group(1).lower(), route=m.group(2).lower(), sources=sources, decided_by="model")
    # No (valid) tag: infer from the links the answer used.
    paths = [s["path"] for s in sources]
    route = "handoff" if paths == ["/contact"] else "answered"
    return Trace(topic=topic_for_path(paths[0] if paths else None), route=route, sources=sources)


class TagStripper:
    """Streams text through while holding back anything that might be the start of a `[[…]]` tag."""

    def __init__(self) -> None:
        self.held = ""
        self.tag: str | None = None
        self.text = ""  # everything emitted

    def feed(self, chunk: str) -> str:
        if self.tag is not None:
            return ""
        self.held += chunk
        start = self.held.find("[[")
        if start >= 0:
            out, rest = self.held[:start], self.held[start:]
            end = rest.find("]]")
            if end >= 0:
                self.tag, self.held = rest[: end + 2], ""
                out = out.rstrip()
            else:
                self.held = rest
            self.text += out
            return out
        # keep a trailing "[" in case the tag's "[[" is split across chunks
        keep = 1 if self.held.endswith("[") else 0
        out = self.held[: len(self.held) - keep]
        self.held = self.held[len(self.held) - keep :]
        self.text += out
        return out

    def finish(self) -> str:
        """Flushes held text that turned out not to be a tag."""
        if self.tag is None and self.held:
            if TAG.search(self.held):
                self.tag, out = self.held, ""
            else:
                out = self.held
            self.held = ""
            self.text += out
            return out
        return ""
