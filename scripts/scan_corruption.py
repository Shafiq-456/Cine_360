#!/usr/bin/env python3
"""Scan src/ for bracket-corruption patterns like `const ovies, theatres]` (missing `[m`)."""
import re
from pathlib import Path

patterns = [
    # const <ident>, set<Ident>] = ...  (missing opening bracket)
    (re.compile(r"const\s+[A-Za-z_$][\w$]*\s*,\s*set[A-Za-z_$][\w$]*\s*\]"), "missing-bracket useState"),
    # const <ident><word without [> ... ] = await
    (re.compile(r"const\s+[a-z][A-Za-z_$]*[a-z],\s*[A-Za-z_$][\w$]*\s*\]\s*="), "missing-bracket destructure"),
    # double commas  `,,`
    (re.compile(r",\s*,"), "double comma"),
    # `? "" : ""` template oddity
    (re.compile(r'\? "" : ""'), "empty-ternary-string"),
    # unclosed bracket per line heuristics: `] = ` without any `[` on line
]

hits = 0
for p in Path("src").rglob("*.ts*"):
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        for rx, label in patterns:
            if rx.search(line):
                print(f"{p}:{i}: [{label}] {line.strip()[:140]}")
                hits += 1
print(f"\n{hits} suspicious lines")
