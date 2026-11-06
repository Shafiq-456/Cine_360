// Extract official trailer YouTube IDs via headless browser search results.
import { execSync } from "child_process";

const QUERIES: Record<string, string> = {
  interstellar: "interstellar 2014 official trailer paramount",
  inception: "inception 2010 official trailer",
  oppenheimer: "oppenheimer official trailer universal pictures",
  jawan: "jawan official trailer shah rukh khan",
  leo: "leo official trailer thalapathy vijay lokesh kanagaraj",
  "kalki-2898-ad": "kalki 2898 ad official trailer prabhas",
  premalu: "premalu malayalam official trailer",
  kantara: "kantara official trailer rsp studio",
};

const ab = (args: string) => execSync(`agent-browser ${args}`, { encoding: "utf8", timeout: 90000 });

const out: Record<string, { id: string; title: string }> = {};
for (const [slug, q] of Object.entries(QUERIES)) {
  try {
    ab(`open "https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" > /dev/null 2>&1 || true`);
    ab(`wait 3500 > /dev/null 2>&1 || true`);
    const raw = ab(
      `eval "JSON.stringify(Array.from(document.querySelectorAll('a[href*=\\\"watch?v=\\\"]')).map(a=>({v:(a.getAttribute('href')||'').match(/v=([A-Za-z0-9_-]{11})/)?.[1]||'',t:(a.getAttribute('title')||'').trim()})).filter(x=>x.v&&x.t).slice(0,3))" 2>/dev/null`
    );
    const parsed = JSON.parse(raw.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"')) as { v: string; t: string }[];
    if (parsed.length > 0) {
      out[slug] = { id: parsed[0].v, title: parsed[0].t };
      console.log(`✓ ${slug}: ${parsed[0].v}  «${parsed[0].t}»`);
    } else {
      console.log(`✗ ${slug}: no titled result`);
    }
  } catch (e) {
    console.log(`✗ ${slug}: ${e instanceof Error ? e.message.slice(0, 80) : "error"}`);
  }
}
console.log("===JSON===");
console.log(JSON.stringify(out, null, 2));
