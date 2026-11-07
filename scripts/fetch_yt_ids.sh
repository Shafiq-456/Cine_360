#!/usr/bin/env bash
# Extract candidate videoIds from YouTube search HTML, validate via oembed.
set -u
declare -A Q=(
  [pathaan]="pathaan+official+trailer"
  [brahmastra]="brahmastra+part+one+official+trailer"
  [baahubali-2]="baahubali+2+official+trailer"
  [sita-ramam]="sita+ramam+official+trailer"
  [jai-bhim]="jai+bhim+official+trailer"
  [tumbbad]="tumbbad+official+trailer"
  [andhadhun]="andhadhun+official+trailer"
  [drishyam-2]="drishyam+2+official+trailer"
  [zindagi-na-milegi-dobara]="zindagi+na+milegi+dobara+official+trailer"
  [queen]="queen+2013+official+trailer"
  [super-deluxe]="super+deluxe+2019+official+trailer"
)
for slug in "${!Q[@]}"; do
  f="/tmp/yt-$slug.html"
  [ -s "$f" ] || curl -sL --max-time 25 -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" \
    "https://www.youtube.com/results?search_query=${Q[$slug]}" -o "$f"
  ids=$(grep -oE '"videoId":"[A-Za-z0-9_-]{11}"' "$f" | grep -oE '[A-Za-z0-9_-]{11}' | awk '!seen[$0]++' | head -4)
  found=""
  for id in $ids; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D$id&format=json")
    if [ "$code" = "200" ]; then found="$id"; break; fi
  done
  if [ -n "$found" ]; then echo "VALID $slug $found"; else echo "NONE  $slug"; fi
done
