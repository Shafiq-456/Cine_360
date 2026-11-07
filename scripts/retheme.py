#!/usr/bin/env python3
"""CINE 360 retheme: Obsidian (blue) -> Velvet Aurora (violet/gold/rose).
Remaps hardcoded hex colours across all cine views. Idempotent."""
from pathlib import Path

# ordered longest-first not needed (all 6-char hex)
MAP = {
    # primary blue -> violet family
    "#477BFF": "#8B5CF6",
    "#5C89FF": "#A78BFA",
    "#9FC0FF": "#C4B5FD",
    "#1A2338": "#2A1B45",
    # cyan -> gold family
    "#20D9E8": "#F2B04C",
    "#0AA6B8": "#A9741A",
    "#F5C518": "#FFD166",
    "#FFD34D": "#FFD166",
    # flame -> rose family
    "#FF713D": "#F0659A",
    "#E50914": "#F43F5E",
    # green
    "#2FBF71": "#34D399",
    # neutrals: cool grey -> lavender
    "#8FA3BF": "#B4A6D4",
    "#B9C4D6": "#D5C9F0",
    "#C9D3E0": "#E4DAF7",
    "#DDE1E8": "#EAE2FA",
    "#F5F7FA": "#F7F2FE",
    "#9AA3B4": "#A99BC6",
    "#98A2B4": "#A79AC5",
    "#98A1B2": "#A79AC5",
    "#AEB7C8": "#BBAEDA",
    "#B4BDCD": "#B4A8D6",
    "#C2CAD8": "#C9BEE4",
    "#EAF2FB": "#F1EBFD",
    "#E9EDF5": "#EFE9FB",
    "#F2F6FC": "#F6F1FE",
    "#3A3F4A": "#4A3D63",
    # backgrounds: navy blacks -> plum blacks
    "#101218": "#1A1029",
    "#171A21": "#1F1330",
    "#12141B": "#1E1230",
    "#0B0D12": "#150C22",
    "#08090C": "#120A1C",
    "#060708": "#0D0716",
    "#050609": "#0E0817",
    "#0A0C10": "#150C22",
}

def hex_to_variants(h: str):
    return {h, h.lower()}

ROOT = Path("/home/z/my-project/src/components/cine")
changed_files = 0
changed_total = 0
for p in ROOT.rglob("*.tsx"):
    text = p.read_text()
    original = text
    for old, new in MAP.items():
        for variant in hex_to_variants(old):
            if variant in text:
                new_variant = new.lower() if variant.islower() else new
                text = text.replace(variant, new_variant)
    if text != original:
        p.write_text(text)
        n = sum(original.count(v) for old in MAP for v in hex_to_variants(old))
        changed_files += 1
        changed_total += n
        print(f"[ok] {p.relative_to(ROOT.parent.parent)}")
print(f"\n{changed_files} files re-skinned, ~{changed_total} replacements")
