#!/usr/bin/env python3
"""Print exact raw lines (repr) for files flagged by tsc, to see true content."""
import sys

targets = {
    "src/components/cine/views/HomeView.tsx": [60, 71, 72],
    "src/components/cine/views/CheckoutView.tsx": [104],
    "src/components/cine/views/AdminView.tsx": [49, 50, 51, 80],
    "src/components/cine/views/owner/OwnerAuditoriums.tsx": [90, 95],
    "src/lib/inventory.ts": [20, 28],
    "scripts/seed.ts": [190, 194, 195, 196],
}

for path, lines in targets.items():
    print(f"\n===== {path} =====")
    with open(path, encoding="utf-8") as f:
        content = f.readlines()
    for n in lines:
        if n - 1 < len(content):
            print(f"L{n}: {content[n-1]!r}")
