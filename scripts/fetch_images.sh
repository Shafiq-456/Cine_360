#!/usr/bin/env bash
# Fetch real movie posters + backdrops for CINE 360 via image-search, then
# download the OSS-hosted files into public/posters/ as jpg.
set -u
OUT=/tmp/imgsearch
mkdir -p "$OUT"
cd /home/z/my-project

declare -A POSTER_Q BACKDROP_Q
POSTER_Q[interstellar]="Interstellar 2014 movie official theatrical poster"
BACKDROP_Q[interstellar]="Interstellar movie scene giant wave planet cinematic still"
POSTER_Q[inception]="Inception 2010 movie official theatrical poster"
BACKDROP_Q[inception]="Inception movie city folding scene cinematic still"
POSTER_Q[oppenheimer]="Oppenheimer 2023 movie official theatrical poster"
BACKDROP_Q[oppenheimer]="Oppenheimer 2023 movie trinity test scene cinematic still"
POSTER_Q[jawan]="Jawan 2023 Hindi movie official poster Shah Rukh Khan"
BACKDROP_Q[jawan]="Jawan 2023 movie action scene still"
POSTER_Q[leo]="Leo 2023 Tamil movie Vijay official poster"
BACKDROP_Q[leo]="Leo 2023 Tamil movie Vijay snow mountain hyena scene still"
POSTER_Q[kalki-2898-ad]="Kalki 2898 AD movie official poster Prabhas"
BACKDROP_Q[kalki-2898-ad]="Kalki 2898 AD movie futuristic scene cinematic still"
POSTER_Q[premalu]="Premalu 2024 Malayalam movie official poster"
BACKDROP_Q[premalu]="Premalu 2024 Malayalam romantic comedy movie scene still"
POSTER_Q[kantara]="Kantara 2022 Kannada movie official poster"
BACKDROP_Q[kantara]="Kantara movie bhoota kola ritual scene forest still"

echo "=== firing searches ==="
for slug in "${!POSTER_Q[@]}"; do
  z-ai image-search -q "${POSTER_Q[$slug]}" --count 4 --gl us --no-rank -o "$OUT/$slug-poster.json" >/dev/null 2>&1 &
  z-ai image-search -q "${BACKDROP_Q[$slug]}" --count 4 --gl us --no-rank -o "$OUT/$slug-backdrop.json" >/dev/null 2>&1 &
done
wait
echo "=== searches done, picking + downloading ==="

pick() { # $1=json $2=mode(min|max ratio side) -> echo url
  bun -e '
const fs=require("fs");
const [file,mode]=process.argv.slice(2);
try{
  const j=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!j.success||!j.results?.length){console.log("");process.exit(0);}
  const scored=j.results.map(r=>{
    const w=parseInt((r.original_width||"0").replace(/\D/g,""))||0;
    const h=parseInt((r.original_height||"0").replace(/\D/g,""))||0;
    const ratio=w&&h?w/h:0;
    let score=0;
    if(mode==="portrait"){ if(ratio>=0.55&&ratio<=0.8) score+=50; else if(ratio>0&&ratio<1.1) score+=20; if(h>=1000) score+=10; }
    else { if(ratio>=1.3&&ratio<=2.4) score+=50; else if(ratio>1.05) score+=20; if(w>=1200) score+=10; }
    return {url:r.original_url,score};
  }).sort((a,b)=>b.score-a.score);
  console.log(scored[0]?.score>=50?scored[0].url:(scored[0]?.url||""));
}catch(e){console.log("");}
' "$1" "$2"
}

mkdir -p public/posters
for slug in interstellar inception oppenheimer jawan leo kalki-2898-ad premalu kantara; do
  PU=$(pick "$OUT/$slug-poster.json" portrait)
  BU=$(pick "$OUT/$slug-backdrop.json" landscape)
  if [ -n "$PU" ]; then curl -sL --max-time 60 -o "public/posters/$slug.jpg" "$PU" && echo "✓ $slug.jpg ($(stat -c%s public/posters/$slug.jpg 2>/dev/null) bytes)"; else echo "✗ $slug poster: no candidate"; fi
  if [ -n "$BU" ]; then curl -sL --max-time 60 -o "public/posters/$slug-backdrop.jpg" "$BU" && echo "✓ $slug-backdrop.jpg ($(stat -c%s public/posters/$slug-backdrop.jpg 2>/dev/null) bytes)"; else echo "✗ $slug backdrop: no candidate"; fi
done
echo "=== verifying image files ==="
for f in public/posters/*.jpg; do
  head -c 3 "$f" | od -An -tx1 | grep -q "ff d8 ff" && echo "OK jpeg: $f" || echo "BAD file: $f"
done
