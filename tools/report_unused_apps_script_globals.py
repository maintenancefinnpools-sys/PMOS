#!/usr/bin/env python3
"""Report top-level PMOS Apps Script declarations with no textual callers.

This is intentionally advisory. A declaration is reported only when its name
appears exactly once across root .gs/.html/.json project files: its declaration.
That avoids deleting browser/menu/trigger callbacks whose names occur in strings.
Apps Script special entry points and intentionally retained public APIs are
excluded explicitly.
"""

from __future__ import annotations

import re
from pathlib import Path

from check_apps_script_globals import (
    FUNCTION_RE,
    VARIABLE_RE,
    ROOT,
    line_number,
    strip_comments_and_strings,
)

SPECIAL_ENTRY_POINTS = {
    "doGet",
    "doPost",
    "onOpen",
    "onEdit",
    "onChange",
}

# These functions are deliberate server-side API boundaries for the Chemistry
# workspace. The current web UI does not expose Chemistry writes yet, but these
# entry points are retained so that future UI work does not need to recreate the
# validated catalog/preview/save contract.
INTENTIONAL_PUBLIC_APIS = {
    "previewChemicalDose",
    "saveChemicalUsage",
    "addChemicalProduct",
}


def main() -> int:
    gs_files = sorted(ROOT.glob("*.gs"))
    searchable_files = (
        gs_files
        + sorted(ROOT.glob("*.html"))
        + sorted(ROOT.glob("*.json"))
    )
    raw_project = "\n".join(
        path.read_text(encoding="utf-8") for path in searchable_files
    )

    declarations: list[tuple[str, str, int, str]] = []
    for path in gs_files:
        source = path.read_text(encoding="utf-8")
        stripped = strip_comments_and_strings(source)
        for match in FUNCTION_RE.finditer(stripped):
            declarations.append(
                (match.group(1), path.name, line_number(stripped, match.start()), "function")
            )
        for match in VARIABLE_RE.finditer(stripped):
            declarations.append(
                (match.group(1), path.name, line_number(stripped, match.start()), "variable")
            )

    candidates = []
    for name, filename, line, kind in declarations:
        if name in SPECIAL_ENTRY_POINTS or name in INTENTIONAL_PUBLIC_APIS:
            continue
        occurrences = len(re.findall(r"\b" + re.escape(name) + r"\b", raw_project))
        if occurrences == 1:
            candidates.append((name, filename, line, kind))

    if not candidates:
        print("No self-only Apps Script global declarations found.")
        return 0

    print("Self-only Apps Script globals — review before deletion:")
    for name, filename, line, kind in sorted(candidates, key=lambda item: (item[1], item[2])):
        print(f"  {filename}:{line}  {kind}  {name}")
    print(f"\n{len(candidates)} candidate(s). This report is advisory only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
