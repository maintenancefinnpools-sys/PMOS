#!/usr/bin/env python3
"""Static PMOS Apps Script global-namespace check.

Apps Script loads project .gs files into one global namespace. Duplicate public
functions or top-level variables can therefore silently override each other or
fail at load time. This checker ignores comments and string/template literals,
then reports duplicate top-level declarations across root .gs files.
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCTION_RE = re.compile(r"^function\s+([A-Za-z_$][\w$]*)\s*\(", re.MULTILINE)
VARIABLE_RE = re.compile(r"^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b", re.MULTILINE)


def strip_comments_and_strings(source: str) -> str:
    """Replace comments and JS string/template contents with spaces.

    Newlines are preserved so reported line numbers still match the source.
    Template literals are treated as strings in their entirety; PMOS uses them
    primarily for HTML/JS payloads, which must not be mistaken for Apps Script
    global declarations.
    """

    chars = list(source)
    out = list(source)
    state = "code"
    quote = ""
    i = 0

    while i < len(chars):
        ch = chars[i]
        nxt = chars[i + 1] if i + 1 < len(chars) else ""

        if state == "code":
            if ch == "/" and nxt == "/":
                out[i] = out[i + 1] = " "
                state = "line_comment"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                out[i] = out[i + 1] = " "
                state = "block_comment"
                i += 2
                continue
            if ch in ("'", '"', "`"):
                quote = ch
                out[i] = " "
                state = "template" if ch == "`" else "string"
                i += 1
                continue
            i += 1
            continue

        if state == "line_comment":
            if ch == "\n":
                state = "code"
            else:
                out[i] = " "
            i += 1
            continue

        if state == "block_comment":
            if ch == "*" and nxt == "/":
                out[i] = out[i + 1] = " "
                state = "code"
                i += 2
            else:
                if ch != "\n":
                    out[i] = " "
                i += 1
            continue

        if state in ("string", "template"):
            if ch == "\\":
                out[i] = " "
                if i + 1 < len(chars):
                    if chars[i + 1] != "\n":
                        out[i + 1] = " "
                    i += 2
                else:
                    i += 1
                continue
            if ch == quote:
                out[i] = " "
                state = "code"
                quote = ""
                i += 1
                continue
            if ch != "\n":
                out[i] = " "
            i += 1
            continue

    return "".join(out)


def line_number(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def main() -> int:
    declarations: dict[str, list[tuple[str, int, str]]] = defaultdict(list)
    files = sorted(ROOT.glob("*.gs"))

    if not files:
        print("No root .gs files found.", file=sys.stderr)
        return 2

    for path in files:
        source = path.read_text(encoding="utf-8")
        stripped = strip_comments_and_strings(source)

        for match in FUNCTION_RE.finditer(stripped):
            declarations[match.group(1)].append(
                (path.name, line_number(stripped, match.start()), "function")
            )
        for match in VARIABLE_RE.finditer(stripped):
            declarations[match.group(1)].append(
                (path.name, line_number(stripped, match.start()), "variable")
            )

    duplicates = {
        name: locations
        for name, locations in declarations.items()
        if len(locations) > 1
    }

    if duplicates:
        print("Duplicate Apps Script global declarations found:")
        for name in sorted(duplicates):
            print(f"\n{name}")
            for filename, line, kind in duplicates[name]:
                print(f"  {filename}:{line} ({kind})")
        return 1

    print(
        f"PMOS global namespace clean: {len(declarations)} declarations "
        f"across {len(files)} .gs files."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
