#!/usr/bin/env python3
"""Parse the 高中三年必背英语 3500 词 PDF into structured JSON.

Source PDF layout is `headword POS.中文释义`, produced by WPS 文字. Entries wrap
across lines, homographs are numbered (`bear 1` / `bear 2`), irregular forms sit
in parentheses (`write(wrote,written)`), and a single entry may carry several
senses, each prefixed by its own POS marker.

Usage: python3 scripts/parse-gaokao-3500.py <source.pdf> <out.json>
"""
import json
import re
import sys

from pypdf import PdfReader

CJK = re.compile(r"[⺀-鿿　-〿＀-￯…‘’“”]")
POS_TOK = r"(?:modalv|modal|prep|pron|conj|abbr|adj|adv|art|aux|num|int|vt|vi|ad|n|v|a)"
# A POS run opens the definition; it never starts the line and is always
# followed by punctuation, a space, or a masked parenthetical.
POS_BOUNDARY = re.compile(rf"(?<=[\s;,)\x00]){POS_TOK}(?=[.&,;*\s\x00(]|$)")
# Inside a definition each sense may be re-tagged, e.g. `广播n.广播节目`.
SENSE_SPLIT = re.compile(rf"({POS_TOK}(?:\s*&\s*{POS_TOK})*\.)")
# A POS run: markers, optionally interleaved with non-Chinese notes like `(be)`.
# A parenthetical containing Chinese is a definition, not a POS note.
POS_RUN = re.compile(
    rf"^\s*(?:{POS_TOK}|\((?![^)]*[⺀-鿿　-〿＀-￯])[^)]*\))[.&,;*\s]*"
    rf"(?:(?:{POS_TOK}|\((?![^)]*[⺀-鿿　-〿＀-￯])[^)]*\))[.&,;*\s]*)*"
)
# A wrapped line resumes with POS markers that run straight into Chinese, e.g.
# `n.广播节目` or `a.&ad.远的`. `a.m.` is a headword, not a continuation.
CONTINUATION = re.compile(rf"^(?:{POS_TOK})[.&]+(?:(?:{POS_TOK})[.&]+)*(?=[⺀-鿿　-〿＀-￯])")
SECTION = re.compile(r"^[A-Z]$")
NOISE = {"高中三年必背", "英语 3500 词", "词汇表"}

POS_CANON = {
    "n": "n", "v": "v", "vt": "vt", "vi": "vi", "a": "adj", "adj": "adj",
    "ad": "adv", "adv": "adv", "prep": "prep", "pron": "pron", "conj": "conj",
    "int": "int", "num": "num", "art": "art", "aux": "aux", "modal": "aux",
    "modalv": "aux", "abbr": "abbr",
}

# The source lists these as variant strings rather than a single headword.
VARIANT_HEADWORDS = {
    "a.m.&am,A.M.&AM": ("a.m.", ["am", "A.M.", "AM"]),
    "p.m.&pm,P.M.&PM": ("p.m.", ["pm", "P.M.", "PM"]),
}

# The source PDF omits definitions for these seven entries.
MISSING_MEANINGS = {
    "a": "一个（不定冠词）",
    "am": "是（be 动词第一人称单数）",
    "anchor": "锚；抛锚，固定",
    "are": "是（be 动词复数现在式）",
    "can’t": "不能，不可以",
    "glass": "玻璃；玻璃杯",
    "is": "是（be 动词第三人称单数）",
    "riddle": "谜语",
}


def read_lines(pdf_path):
    reader = PdfReader(pdf_path)
    for page in reader.pages:
        for line in page.extract_text().splitlines():
            line = line.replace("​", "").strip()
            if line and line not in NOISE and not re.fullmatch(r"\d+", line):
                yield line


def group_entries(lines):
    """Rejoin wrapped lines. A continuation either starts with Chinese or with a
    bare POS marker carried over from the previous line."""
    entries, letter = [], None
    for line in lines:
        if SECTION.fullmatch(line):
            letter = line
            continue
        starts_entry = re.match(r"^[A-Za-z]", line) and not CONTINUATION.match(line)
        if starts_entry or not entries:
            entries.append({"letter": letter, "raw": line})
        else:
            entries[-1]["raw"] += line
    return entries


def mask_parens(text):
    captured = []

    def stash(match):
        captured.append(match.group(0))
        return f"\x00{len(captured) - 1}\x00"

    return re.sub(r"\([^)]*\)", stash, text), captured


def unmask(text, captured):
    return re.sub(r"\x00(\d+)\x00", lambda m: captured[int(m.group(1))], text)


def split_senses(definition, entry_pos):
    """Turn `大约；到处prep.关于` into [(adv, '大约；到处'), (prep, '关于')]. The first
    sense carries no marker of its own; it inherits the entry's leading POS."""
    parts = SENSE_SPLIT.split(definition)
    senses, pos = [], None
    for chunk in parts:
        if SENSE_SPLIT.fullmatch(chunk):
            pos = chunk.rstrip(".")
            continue
        text = chunk.strip(" .;；,，、")
        if text:
            resolved = normalize_pos(pos) or (entry_pos[:1] if not senses else [])
            senses.append({"pos": resolved, "text": text})
        pos = None
    return senses


def tidy_inflections(raw):
    """`plchildren` and `Amaluminum` lose their separator in extraction."""
    if not raw:
        return None
    return re.sub(r"^(pl|Am|Br)(?=[a-z])", r"\1. ", raw).strip()


def normalize_pos(raw):
    if not raw:
        return []
    found = [POS_CANON[t] for t in re.findall(POS_TOK, raw.lower()) if t in POS_CANON]
    return list(dict.fromkeys(found))


def parse_entry(entry):
    raw = entry["raw"]
    masked, captured = mask_parens(raw)
    boundary = POS_BOUNDARY.search(masked)
    cut = boundary.start() if boundary else (masked.find(" ") if " " in masked else len(masked))
    head, tail = masked[:cut], masked[cut:]

    tail = unmask(tail, captured)
    run = POS_RUN.match(tail)
    split_at = run.end() if run else 0
    pos_run = tail[:split_at].strip()
    definition = tail[split_at:].strip()

    head = unmask(head, captured).strip()
    inflections = homograph = alias = None
    paren = re.search(r"\(([^)]*)\)", head)
    if paren:
        inflections = paren.group(1).strip()
        head = head[: paren.start()] + head[paren.end():]
    number = re.search(r"\s*(\d)\s*", head)
    if number:
        homograph = int(number.group(1))
        head = head[: number.start()] + " " + head[number.end():]
    equals = re.search(r"=\s*(\S+)", head)
    if equals:
        alias = equals.group(1).strip()
        head = head[: equals.start()]

    word = head.strip().strip("=;, ").strip()
    variants = []
    if word in VARIANT_HEADWORDS:
        word, variants = VARIANT_HEADWORDS[word]
    if not definition:
        definition = MISSING_MEANINGS.get(word, "")

    pos = normalize_pos(pos_run)
    return {
        "word": word,
        "letter": entry["letter"],
        "pos": pos,
        "meaning": definition,
        "senses": split_senses(definition, pos),
        "variants": variants,
        "inflections": tidy_inflections(inflections),
        "homograph": homograph,
        "alias": alias,
    }


def main():
    src, dst = sys.argv[1], sys.argv[2]
    entries = group_entries(read_lines(src))
    records = [parse_entry(e) for e in entries]

    invalid = [r for r in records if not re.fullmatch(r"[A-Za-z][A-Za-z\-'’&.\s]*", r["word"])]
    empty = [r for r in records if not r["meaning"]]
    if invalid or empty:
        print(f"warning: {len(invalid)} malformed headwords, {len(empty)} empty definitions")
        for r in (invalid + empty)[:10]:
            print("  ", r["word"], "|", r["meaning"][:40])

    for i, record in enumerate(records, 1):
        record["id"] = i

    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=1)
    print(f"wrote {len(records)} entries to {dst}")


if __name__ == "__main__":
    main()
