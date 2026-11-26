"""Text clean-up for spoken answers (mirrors the browser's speakable()/neutral())."""

from __future__ import annotations

import re

_ABBR = re.compile(r"\b(?:Dr|Mr|Mrs|Ms|St|vs|etc|e\.g|i\.e|No)\.$", re.I)


def speakable(text: str) -> str:
    t = re.sub(r"\[\[[^\]]*\]\]", "", text)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"(^|[\s(])/[a-z0-9][a-z0-9\-/]*", r"\1", t, flags=re.I)
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"^\s*(?:[-•*]|\d+\.)\s+", "", t, flags=re.M)
    t = re.sub(r"[*_`#>~|]", "", t)
    t = re.sub(r"\s+([,.!?;:])", r"\1", t)
    return re.sub(r"\s+", " ", t).strip()


def neutral(text: str, name: str = "Azad") -> str:
    """Owner rule: 'Azad'/'Azad's', never he/she (answers on this line are always about Azad)."""
    def cap(m: re.Match, r: str) -> str:
        return r[0].upper() + r[1:] if m.group(0)[0].isupper() else r
    t = re.sub(r"\b(himself|herself)\b", name, text, flags=re.I)
    t = re.sub(r"\b(his|her)\b(?=\s+[a-z])", f"{name}'s", t, flags=re.I)
    return re.sub(r"\b(he|she|him|her)\b", lambda m: cap(m, name), t, flags=re.I)


def take_sentences(buf: str, min_chars: int = 24) -> tuple[list[str], str]:
    """Complete sentences off the front of a streamed buffer (waits on 'Dr.' and decimals)."""
    out, start = [], 0
    for m in re.finditer(r"[.!?]+(?=\s)", buf):
        end = m.end()
        piece = buf[start:end].strip()
        if _ABBR.search(piece) or (re.search(r"\d\.$", piece) and re.match(r"\s*\d", buf[end:])):
            continue
        if len(piece) < min_chars:
            continue
        out.append(piece)
        start = end
    return out, buf[start:].lstrip()
