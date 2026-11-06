// Generates procedural SVG movie posters + backdrops into public/posters/.
// Used because no external movie API / asset CDN is connected (clearly demo art).
import { writeFileSync, mkdirSync } from "fs";

type Movie = { slug: string; title: string; tagline: string; c1: string; c2: string; c3: string };

const MOVIES: Movie[] = [
  { slug: "interstellar", title: "INTERSTELLAR", tagline: "Mankind was born on Earth.\nIt was never meant to die here.", c1: "#0B1026", c2: "#1B2A4A", c3: "#477BFF" },
  { slug: "inception", title: "INCEPTION", tagline: "Your mind is the scene of the crime.", c1: "#12080E", c2: "#3C1B2E", c3: "#FF713D" },
  { slug: "oppenheimer", title: "OPPENHEIMER", tagline: "The world forever changes.", c1: "#1A0E06", c2: "#4A2410", c3: "#F5C518" },
  { slug: "jawan", title: "JAWAN", tagline: "Ready for retribution.", c1: "#0A0A0A", c2: "#262626", c3: "#E5484D" },
  { slug: "leo", title: "LEO", tagline: "Quiet before the storm.", c1: "#0D0D0B", c2: "#2B2B1F", c3: "#20D9E8" },
  { slug: "kalki-2898-ad", title: "KALKI 2898 AD", tagline: "The future is written in myth.", c1: "#10101E", c2: "#2A2440", c3: "#9D7BFF" },
  { slug: "premalu", title: "PREMALU", tagline: "A love story for the confused.", c1: "#14090F", c2: "#3A1B2A", c3: "#FF8FB1" },
  { slug: "kantara", title: "KANTARA", tagline: "A legend of the forest.", c1: "#0C1208", c2: "#24361B", c3: "#7BC950" },
  // ---- 2026-11 expansion: 8 additional titles ----
  { slug: "rrr", title: "RRR", tagline: "Rise. Roar. Revolt.", c1: "#160B08", c2: "#3D1E12", c3: "#FF713D" },
  { slug: "vikram", title: "VIKRAM", tagline: "Once upon a time, there lived a ghost.", c1: "#0A0A0D", c2: "#1F2430", c3: "#F5C518" },
  { slug: "3-idiots", title: "3 IDIOTS", tagline: "All is well.", c1: "#0B1A12", c2: "#1E3A2A", c3: "#5BD97C" },
  { slug: "dune-part-two", title: "DUNE: PART TWO", tagline: "Long live the fighters.", c1: "#1A120A", c2: "#40301C", c3: "#E8B56A" },
  { slug: "the-dark-knight", title: "THE DARK KNIGHT", tagline: "Why so serious?", c1: "#0A0A0C", c2: "#1A1E28", c3: "#6F8DB4" },
  { slug: "96", title: "96", tagline: "Two souls. One afternoon.", c1: "#140D0B", c2: "#33221C", c3: "#F0A32A" },
  { slug: "manjummel-boys", title: "MANJUMMEL BOYS", tagline: "Friends who dive into darkness together.", c1: "#0A1214", c2: "#1C3238", c3: "#37C4D8" },
  { slug: "kung-fu-panda-4", title: "KUNG FU PANDA 4", tagline: "The tale of the Dragon Warrior continues.", c1: "#101318", c2: "#2A3140", c3: "#FFD24D" },
];

function poster(m: Movie): string {
  const lines = m.tagline.split("\n").map((t, i) =>
    `<text x="60" y="${760 + i * 34}" font-family="Georgia, serif" font-size="24" fill="#DDE1E8" opacity="0.85">${t}</text>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${m.c1}"/><stop offset="100%" stop-color="${m.c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="60%">
      <stop offset="0%" stop-color="${m.c3}" stop-opacity="0.55"/>
      <stop offset="55%" stop-color="${m.c3}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${m.c3}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="900" fill="url(#bg)"/>
  <rect width="600" height="900" fill="url(#glow)"/>
  <circle cx="300" cy="310" r="150" fill="none" stroke="${m.c3}" stroke-opacity="0.5" stroke-width="1.5"/>
  <circle cx="300" cy="310" r="110" fill="none" stroke="${m.c3}" stroke-opacity="0.3" stroke-width="1"/>
  <circle cx="300" cy="310" r="6" fill="${m.c3}"/>
  <path d="M0 640 L600 560 L600 900 L0 900 Z" fill="#000" opacity="0.35"/>
  <text x="60" y="120" font-family="Helvetica, Arial, sans-serif" font-size="18" letter-spacing="6" fill="#DDE1E8" opacity="0.7">CINE 360 PRESENTS</text>
  <text x="58" y="700" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="52" fill="#F5F7FA" letter-spacing="2">${m.title}</text>
  ${lines}
  <rect x="60" y="840" width="180" height="3" fill="${m.c3}"/>
  <text x="60" y="872" font-family="Helvetica, Arial, sans-serif" font-size="15" letter-spacing="3" fill="#8FA3BF">DEMO ARTWORK — PROCEDURALLY GENERATED</text>
</svg>`;
}

function backdrop(m: Movie): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${m.c1}"/><stop offset="100%" stop-color="${m.c2}"/>
    </linearGradient>
    <radialGradient id="g" cx="72%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${m.c3}" stop-opacity="0.5"/><stop offset="100%" stop-color="${m.c3}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g stroke="${m.c3}" stroke-opacity="0.14">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="${i * 38}" x2="1600" y2="${i * 38 - 120}"/>`).join("")}
  </g>
  <rect x="880" y="240" width="600" height="338" rx="8" fill="none" stroke="${m.c3}" stroke-opacity="0.6" stroke-width="3"/>
  <text x="1180" y="640" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="8" fill="#F5F7FA" opacity="0.9">THE SCREEN</text>
  <text x="100" y="470" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="84" fill="#F5F7FA">${m.title}</text>
  <text x="102" y="530" font-family="Georgia, serif" font-size="30" fill="#DDE1E8" opacity="0.8">${m.tagline.split("\n")[0]}</text>
</svg>`;
}

mkdirSync("public/posters", { recursive: true });
for (const m of MOVIES) {
  writeFileSync(`public/posters/${m.slug}.svg`, poster(m));
  writeFileSync(`public/posters/${m.slug}-backdrop.svg`, backdrop(m));
}
console.log(`Generated ${MOVIES.length} posters + backdrops into public/posters/`);
