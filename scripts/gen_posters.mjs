/**
 * Generates raw AI key art for movies that currently only have placeholder SVGs.
 * - Poster art: 768x1344 (portrait)  -> scripts/tmp/posters_raw/{slug}.png
 * - Backdrop:   1344x768 (landscape) -> scripts/tmp/posters_raw/{slug}-backdrop.png
 * Resumable: skips files that already exist and are valid PNGs.
 * Run: bun scripts/gen_posters.mjs [--only slug]
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const OUT = path.join(process.cwd(), "scripts", "tmp", "posters_raw");
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const STYLE_TAIL =
  "cinematic movie key art, dramatic lighting, rich color grade, ultra detailed, high quality digital painting, poster composition with clear focal subject, absolutely no text, no words, no letters, no typography, no watermark, no logo";

const JOBS = [
  {
    slug: "ramayana-rise-of-a-legend",
    poster:
      "Epic mythological Indian warrior prince with a grand golden bow standing on a cliff at golden dawn, ancient stone temple towers below, divine sun rays parting swirling clouds, majestic scale",
    backdrop:
      "Vast epic ancient Indian battlefield plain at golden dawn, temple gopurams on the horizon, divine light rays through storm clouds, spearmen silhouettes",
  },
  {
    slug: "nakhrewaalii",
    poster:
      "Vibrant retro Bollywood romantic comedy, playful young Indian woman in a colorful pink and teal lehenga with vintage sunglasses, henna-decorated hands, retro scooter and festive bazaar street behind her, pop-art color burst",
    backdrop:
      "Colorful Indian wedding street celebration at dusk, marigold garlands strung across old lanes, fairy lights bokeh, pink and teal palette",
  },
  {
    slug: "pyre",
    poster:
      "Solemn Himalayan mountain drama, two hooded women silhouettes beside a small wooden pyre on a misty ridge at first light, cold blue fog with a faint ember glow, minimalist emotional composition",
    backdrop:
      "Misty Himalayan stone village at dawn, slate-roofed houses on terraced slopes, cold fog, a few faint warm window lights",
  },
  {
    slug: "gajab-raat",
    poster:
      "Dark crime thriller night scene, lone silhouette holding a flashlight in a narrow old Indian city alley during rain, neon sign reflections in puddles, moody teal and orange film noir",
    backdrop:
      "Rain-soaked old Indian city street at night seen low angle, glowing neon signs reflecting in wet asphalt, drifting steam, dark noir",
  },
  {
    slug: "mirzapur-the-movie",
    poster:
      "Gritty crime saga, dusty north Indian badlands at dusk, a vintage black Ambassador car with armed men silhouettes, drifting gun smoke and dust, rust orange and teal color grade, raw intensity",
    backdrop:
      "Dusty badlands highway at dusk with a vintage black car kicking up smoke, rust orange sky, telephone poles receding to horizon",
  },
  {
    slug: "paradise-lost",
    poster:
      "Korean mystery thriller, a lone figure in a long dark coat on a foggy volcanic coastal cliff, abandoned lighthouse behind, cold desaturated blue-green palette, heavy sea mist, minimalist dread",
    backdrop:
      "Foggy volcanic coastline with an abandoned lighthouse at dusk, cold blue-green sea mist, a lone wooden pier leading into fog",
  },
  {
    slug: "raise-the-red-lantern",
    poster:
      "1920s Chinese courtyard mansion at night, rows of glowing red lanterns hanging across symmetrical grey-walled architecture, a distant woman in traditional dress beneath them, dramatic red and charcoal palette",
    backdrop:
      "Symmetrical 1920s Chinese courtyard mansion interior at night, rows of glowing red lanterns, grey brick walls, deep shadows",
  },
  {
    slug: "nurture",
    poster:
      "Elegant psychological horror, a dim vintage nursery with an empty wooden crib, a single swinging light bulb, long soft shadows stretching across floral wallpaper, desaturated cream and deep shadow palette",
    backdrop:
      "Dim vintage home hallway at night, a nursery door slightly open with pale light spilling out, deep shadows on floral wallpaper",
  },
  {
    slug: "scene",
    poster:
      "A love letter to cinema, vintage single-screen theatre interior, glowing projector beam cutting through dust above rows of silhouetted audience heads, faded grand red curtains, warm nostalgic amber",
    backdrop:
      "Grand vintage theatre auditorium with a closed red velvet curtain and a glowing projector beam cutting through dust, ornate balconies",
  },
  {
    slug: "mookuthi-amman-2",
    poster:
      "Divine Tamil fantasy, a radiant golden temple festival at night with rows of oil lamps, an ornate glowing gold nose-ring jewel floating in divine light, marigold flowers swirling, saffron and gold devotional grandeur",
    backdrop:
      "Grand South Indian temple gopuram tower at night lit by thousands of oil lamps, marigold garlands, divine golden glow, deep blue night sky",
  },
  {
    slug: "jailer-2",
    poster:
      "Intense action thriller, stern middle-aged Indian man in silhouette standing in a dim prison corridor, tiger-stripe bands of amber light through iron bars, dark amber and black palette, smoldering atmosphere",
    backdrop:
      "Dim prison corridor with amber light stripes cast through iron bars, thin smoke on the floor, a lone chair in a pool of light",
  },
  {
    slug: "karuppu",
    poster:
      "Dark fantasy action, a majestic black horse rearing amid swirling black smoke and crimson embers, a shadowy rider silhouette, stormy night sky, striking black and blood-red palette",
    backdrop:
      "A black horse galloping through a stormy plain with crimson lightning splitting the horizon, embers and smoke trailing",
  },
  {
    slug: "vishwanath-and-sons",
    poster:
      "Warm family drama, an old South Indian watchmaking shop interior at dusk, three generations of hands together repairing an antique brass clock, worn wooden workbench, tungsten lamp glow, heritage wood interior",
    backdrop:
      "Heritage South Indian shop interior at dusk, wooden counters, brass lamps, glass display cases glowing warmly, dust motes in tungsten light",
  },
  {
    slug: "mandaadi",
    poster:
      "Coastal Tamil drama, a strong fisherwoman silhouette standing firm on a storm-lashed harbour jetty, catamarans and nets behind her, giant slate-blue waves, a warm sunrise break on the horizon",
    backdrop:
      "Stormy fishing harbour at dawn, catamarans rocking on a rough slate-blue sea, ropes and nets in the foreground, warm sunrise break on the horizon",
  },
  {
    slug: "thaai-kizhavi",
    poster:
      "Emotional rural Tamil drama, an elderly mother in a saree walking through endless green paddy fields at golden hour, a lone banyan tree, soft warm light and gentle mist, tender minimalist composition",
    backdrop:
      "Endless green paddy fields at golden hour with a lone banyan tree and a distant walking silhouette, warm mist over the fields",
  },
  {
    slug: "haiku",
    poster:
      "Poetic melancholic drama, rain streaks running down a window at night, an open notebook with a fountain pen and a cup of tea on the sill, a single warm lamp in a dim blue room, delicate minimal composition",
    backdrop:
      "Night window with rain streaks overlooking dim city lights, an open notebook and a small warm lamp on the window sill, blue melancholic tones",
  },
  {
    slug: "dorothy",
    poster:
      "Tamil mystery thriller, an elegant colonial bungalow staircase with a mysterious woman silhouette in a flowing dress at the top, teal shadows and warm amber window light, moody haze",
    backdrop:
      "Colonial bungalow hallway with a grand wooden staircase, teal shadows, warm amber lamps, misty mysterious haze",
  },
  {
    slug: "sardar-2",
    poster:
      "High-tech spy action, a silhouetted agent with night-vision goggles standing before a wall of glowing blue surveillance screens and world maps, electric blue and black palette, sleek and cool",
    backdrop:
      "Dark surveillance operations room with a huge wall of glowing blue screens showing world maps and data streams, empty swivel chair in foreground",
  },
  {
    slug: "cine360-first-light",
    poster:
      "Golden sunrise over a film studio backlot, a vintage movie camera silhouette on a crane, a clapperboard resting on a case, glowing anamorphic lens flare, hopeful warm celebration of cinema",
    backdrop:
      "Golden sunrise over a film studio backlot, camera crane silhouettes, equipment cases and cables, warm anamorphic lens flare",
  },
  {
    slug: "brahmastra",
    backdropOnly: true,
    backdrop:
      "Astral magical energy, glowing blue flames swirling around an ancient temple of light, cosmic sky with stars, mystical fantasy spectacle",
  },
  {
    slug: "baahubali-2",
    backdropOnly: true,
    backdrop:
      "Epic Indian historical battlefield with a giant golden statue and war elephants, war banners flying, dramatic sunset sky",
  },
  {
    slug: "andhadhun",
    backdropOnly: true,
    backdrop:
      "Film noir suspense, blind pianist silhouette at a grand piano in a dim Mumbai apartment, single hard key light, long shadows",
  },
  {
    slug: "drishyam-2",
    backdropOnly: true,
    backdrop:
      "Rainy small-town Indian night, a family silhouetted outside a modest house under a single streetlight, tense thriller mood",
  },
  {
    slug: "jai-bhim",
    backdropOnly: true,
    backdrop:
      "Courthouse steps at dawn, a lone advocate silhouette carrying case files, warm hopeful light through tall stone columns",
  },
  {
    slug: "pathaan",
    backdropOnly: true,
    backdrop:
      "High-octane spy action, an explosive chase across a snowy bridge, helicopter overhead and burning vehicles, cold blue and fire orange",
  },
  {
    slug: "ponniyin-selvan-1",
    backdropOnly: true,
    backdrop:
      "Chola dynasty grandeur, ancient Tamil temple shores at golden dusk, warships on the horizon, swaying palms, epic period spectacle",
  },
  {
    slug: "queen",
    backdropOnly: true,
    backdrop:
      "Joyful solo honeymoon in Paris, a young woman with a suitcase in front of the Eiffel Tower, bright cheerful daylight, café terraces",
  },
  {
    slug: "sita-ramam",
    backdropOnly: true,
    backdrop:
      "1960s romantic epic, a marigold garden at dusk with soldiers and handwritten letters, warm nostalgic golden glow",
  },
  {
    slug: "super-deluxe",
    backdropOnly: true,
    backdrop:
      "Surreal Chennai anthology, a giant cloud shaped like a couple floating over a rain-soaked city street with neon reflections, quirky and vivid",
  },
  {
    slug: "tumbbad",
    backdropOnly: true,
    backdrop:
      "Gothic horror, a rain-soaked crumbling ancestral mansion in endless monsoon, mossy stone, faint cursed treasure glow in a doorway",
  },
  {
    slug: "zindagi-na-milegi-dobara",
    backdropOnly: true,
    backdrop:
      "Three friends in an open convertible on a bright Spanish coastal road, azure sea, vibrant summer energy, road-trip freedom",
  },
];

function isPngValid(p) {
  if (!fs.existsSync(p)) return false;
  try {
    const b = fs.readFileSync(p);
    // accept real PNG magic or JPEG magic (the z-ai CLI writes JPEG bytes into .png names)
    const isPng = b[0] === 0x89 && b[1] === 0x50;
    const isJpeg = b[0] === 0xff && b[1] === 0xd8;
    return b.length > 50000 && (isPng || isJpeg);
  } catch {
    return false;
  }
}

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const USE_CLI = process.argv.includes("--cli");

function genViaCli(prompt, size, outPath) {
  // NB: do NOT pipe stderr — the CLI's verbose output can fill the pipe and deadlock
  execFileSync("z-ai", ["image", "-p", `${prompt}, ${STYLE_TAIL}`, "-o", outPath, "-s", size],
    { stdio: ["ignore", "ignore", "ignore"], timeout: 180000 });
}

async function genOne(zai, prompt, size, outPath, kind) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (USE_CLI) {
        genViaCli(prompt, size, outPath);
      } else {
        const res = await zai.images.generations.create({ prompt: `${prompt}, ${STYLE_TAIL}`, size });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error("empty response");
        const buf = Buffer.from(b64, "base64");
        if (buf.length < 50000) throw new Error(`suspiciously small (${buf.length}B)`);
        fs.writeFileSync(outPath, buf);
      }
      if (!isPngValid(outPath)) throw new Error("output failed validation");
      log(`OK  ${path.basename(outPath)} (${Math.round(fs.statSync(outPath).size / 1024)}KB)`);
      return true;
    } catch (e) {
      log(`ERR ${kind} ${path.basename(outPath)} attempt ${attempt}: ${e.message}`);
      if (fs.existsSync(outPath) && !isPngValid(outPath)) fs.rmSync(outPath, { force: true });
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return false;
}

if (process.argv.includes("--emit")) {
  // Emit a plain bash script (bun child_process is unreliable in this sandbox)
  const esc = (s) => s.replace(/'/g, `'\\''`);
  const lines = ["#!/bin/bash", "set -u", `cd ${process.cwd()}`];
  for (const job of JOBS) {
    if (only && job.slug !== only) continue;
    if (!job.backdropOnly) {
      const p = path.join(OUT, `${job.slug}.png`);
      if (!isPngValid(p)) lines.push(`echo "GEN ${job.slug}.png"; timeout 150 z-ai image -p '${esc(job.poster + ", " + STYLE_TAIL)}' -o '${p}' -s 768x1344 >/dev/null 2>&1 || echo "FAILED ${job.slug}.png"`);
    }
    if (job.backdrop) {
      const p = path.join(OUT, `${job.slug}-backdrop.png`);
      if (!isPngValid(p)) lines.push(`echo "GEN ${job.slug}-backdrop.png"; timeout 150 z-ai image -p '${esc(job.backdrop + ", " + STYLE_TAIL)}' -o '${p}' -s 1344x768 >/dev/null 2>&1 || echo "FAILED ${job.slug}-backdrop.png"`);
    }
  }
  lines.push('echo "EMIT_DONE"');
  console.log(lines.join("\n"));
  process.exit(0);
}

let zai = null;
if (!USE_CLI) zai = await ZAI.create();
let ok = 0, fail = 0;
for (const job of JOBS) {
  if (only && job.slug !== only) continue;
  if (!job.backdropOnly) {
    const p = path.join(OUT, `${job.slug}.png`);
    if (isPngValid(p)) log(`SKIP ${job.slug}.png (exists)`);
    else (await genOne(zai, job.poster, "768x1344", p, "poster")) ? ok++ : fail++;
  }
  if (job.backdrop) {
    const p = path.join(OUT, `${job.slug}-backdrop.png`);
    if (isPngValid(p)) log(`SKIP ${job.slug}-backdrop.png (exists)`);
    else (await genOne(zai, job.backdrop, "1344x768", p, "backdrop")) ? ok++ : fail++;
  }
}
log(`DONE generated=${ok} failed=${fail}`);
