#!/usr/bin/env bash
# Fetch real movie posters via z-ai image-search and download the best portrait candidate.
# Usage: fetch_posters.sh slug1 "Query 1" slug2 "Query 2" ...
set -u
cd /home/z/my-project
OUT=/tmp/poster-json
mkdir -p "$OUT" public/posters

while [ "$#" -gt 0 ]; do
  slug="$1"; query="$2"; shift 2
  dest="public/posters/${slug}.jpg"
  if [ -s "$dest" ]; then echo "[skip] $slug (exists)"; continue; fi
  echo "=== searching: $slug ==="
  timeout 120 z-ai image-search -q "$query" --count 6 --gl us --no-rank > "$OUT/$slug.json" 2>/dev/null
  if [ ! -s "$OUT/$slug.json" ]; then echo "[warn] empty result for $slug"; continue; fi
  # pick the most portrait-like (h/w ratio closest to a poster ~0.7) downloadable candidate
  SLUG="$slug" bun -e '
    const fs = require("fs");
    const slug = process.env.SLUG;
    const raw = fs.readFileSync(`/tmp/poster-json/${slug}.json`, "utf8");
    const start = raw.indexOf("{");
    if (start < 0) { console.log(""); process.exit(0); }
    const j = JSON.parse(raw.slice(start));
    if (!j.success || !j.results?.length) { console.log(`[fail] ${slug}: ${j.error||"no results"}`); process.exit(0); }
    const scored = j.results.map(r => {
      const w = parseInt((r.original_width||"").replace(/\D/g,"")) || 0;
      const h = parseInt((r.original_height||"").replace(/\D/g,"")) || 0;
      const ratio = w && h ? h / w : 0;
      // theatrical posters are ~1.4-1.5 h/w; score by closeness, prefer bigger area
      const posterScore = ratio >= 1.15 ? 1 - Math.abs(ratio - 1.45) : ratio * 0.25;
      return { url: r.original_url, w, h, ratio, posterScore };
    }).sort((a,b) => b.posterScore - a.posterScore);
    console.log(JSON.stringify({slug, picked: scored[0], all: scored.map(s=>[s.w,s.h,s.url.slice(0,60)])}));
  ' > "$OUT/$slug.pick.json"
  url=$(bun -e "const j=require('/tmp/poster-json/$slug.pick.json'); console.log(j.picked?.url||'')" 2>/dev/null)
  if [ -z "$url" ]; then echo "[fail] $slug: no pick"; continue; fi
  curl -sL --max-time 40 "$url" -o "$dest" && echo "[ok] $slug -> $(wc -c < "$dest") bytes"
done
echo DONE
