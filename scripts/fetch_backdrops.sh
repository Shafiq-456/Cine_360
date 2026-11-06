#!/usr/bin/env bash
# Sequential backdrop fetch (parallel -o mode failed; stdout parse works).
set -u
cd /home/z/my-project
mkdir -p /tmp/bk

fetch_one() {
  local slug="$1"; local q="$2"
  local json; json=$(timeout 150 z-ai image-search -q "$q" --count 4 --gl us --no-rank 2>/dev/null | sed -n '/^{/,$p')
  [ -z "$json" ] && { echo "✗ $slug: no json"; return 1; }
  local url
  url=$(printf '%s' "$json" | bun -e '
const j=JSON.parse(await Bun.stdin.text());
if(!j.success||!j.results?.length){console.log("");process.exit(0);}
const scored=j.results.map(r=>{
  const w=parseInt((r.original_width||"").replace(/\D/g,""))||0;
  const h=parseInt((r.original_height||"").replace(/\D/g,""))||0;
  const ratio=w&&h?w/h:0;
  let s=0;
  if(ratio>=1.3&&ratio<=2.6) s+=50; else if(ratio>1.05) s+=15;
  if(w>=1200) s+=10;
  return {u:r.original_url,s};
}).sort((a,b)=>b.s-a.s);
console.log(scored[0]?.s>=50?scored[0].u:"");
')
  if [ -n "$url" ]; then
    curl -sL --max-time 60 -o "public/posters/$slug-backdrop.jpg" "$url"
    if head -c 3 "public/posters/$slug-backdrop.jpg" | od -An -tx1 2>/dev/null | grep -q "ff d8 ff"; then
      echo "✓ $slug-backdrop.jpg ($(stat -c%s "public/posters/$slug-backdrop.jpg") bytes)"
    else
      echo "✗ $slug: downloaded file is not a JPEG"
    fi
  else
    echo "✗ $slug: no landscape candidate"
  fi
}

fetch_one interstellar "Interstellar movie giant wave water planet scene cinematic widescreen"
fetch_one inception "Inception movie folding city street scene cinematic widescreen"
fetch_one oppenheimer "Oppenheimer 2023 movie trinity test explosion scene widescreen"
fetch_one jawan "Jawan movie Shah Rukh Khan action scene widescreen still"
fetch_one leo "Leo 2023 Tamil movie Vijay snow mountain action scene widescreen"
fetch_one kalki-2898-ad "Kalki 2898 AD movie futuristic world scene widescreen"
fetch_one premalu "Premalu Malayalam movie romantic scene widescreen still"
fetch_one kantara "Kantara movie bhoota kola forest ritual scene widescreen"
fetch_one rrr "RRR movie Rajamouli action fire scene widescreen still"
fetch_one vikram "Vikram 2022 Tamil movie Kamal Haasan action scene widescreen"
fetch_one 3-idiots "3 Idiots movie Aamir Khan college scene widescreen still"
fetch_one dune-part-two "Dune Part Two movie sandworm desert action widescreen"
fetch_one the-dark-knight "The Dark Knight movie Gotham city night widescreen still"
fetch_one 96 "96 Tamil movie Vijay Sethupathi Trisha romantic scene widescreen"
fetch_one manjummel-boys "Manjummel Boys movie cave rescue scene widescreen"
fetch_one kung-fu-panda-4 "Kung Fu Panda 4 Po dragon warrior widescreen scene"
echo DONE
