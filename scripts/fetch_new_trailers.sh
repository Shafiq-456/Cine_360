#!/usr/bin/env bash
# Find official trailer YouTube IDs for the new movies: web_search -> extract
# youtube watch ids -> validate via oembed (200 = real video). Outputs JS map lines.
set -u
cd /home/z/my-project
declare -A Q=(
  [pathaan]="Pathaan official trailer youtube watch"
  [brahmastra]="Brahmastra Part One Shiva official trailer youtube"
  [baahubali-2]="Baahubali 2 The Conclusion official trailer youtube"
  [sita-ramam]="Sita Ramam official trailer youtube"
  [ponniyin-selvan-1]="Ponniyin Selvan Part 1 official trailer youtube"
  [jai-bhim]="Jai Bhim official trailer youtube"
  [tumbbad]="Tumbbad official trailer youtube"
  [andhadhun]="Andhadhun official trailer youtube"
  [drishyam-2]="Drishyam 2 official trailer youtube"
  [zindagi-na-milegi-dobara]="Zindagi Na Milegi Dobara official trailer youtube"
  [queen]="Queen 2013 official trailer youtube"
  [super-deluxe]="Super Deluxe 2019 official trailer youtube"
)
mkdir -p /tmp/trailer-json
for slug in "${!Q[@]}"; do
  out="/tmp/trailer-json/$slug.txt"
  [ -s "$out" ] && { echo "[skip] $slug"; continue; }
  z-ai function -n web_search -a "{\"query\": \"${Q[$slug]}\", \"num\": 8}" > "$out" 2>/dev/null
  echo "[search] $slug exit=$?"
done
# extract + validate
for slug in "${!Q[@]}"; do
  f="/tmp/trailer-json/$slug.txt"
  [ -s "$f" ] || continue
  ids=$(grep -oE "(youtube\.com/watch\?v=|youtu\.be/)[A-Za-z0-9_-]{11}" "$f" | grep -oE "[A-Za-z0-9_-]{11}$" | awk '!seen[$0]++' | head -5)
  for id in $ids; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D$id&format=json")
    if [ "$code" = "200" ]; then echo "VALID $slug $id"; break; fi
  done
done
