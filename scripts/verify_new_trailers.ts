// Verify candidate YouTube trailer IDs for the new movies via the official
// oembed endpoint (200 + title ⇒ real, embeddable video). Prints the winner.
const CANDIDATES: Record<string, string[]> = {
  rrr: ["f_vbAtFSEc0", "fHgT4hgvK9s", "Neuk27o4ePc"],
  vikram: ["czaqSbJfnL0", "OKBMCL-frPU", "1RDrVM0FGcU"],
  "3-idiots": ["K0eDlFX9GMc", "SFxhgBjUOEo", "0sPtkwEx7z8"],
  "dune-part-two": ["Way9Dexny3w", "n9xhJrPXop4", "MNjUJ_gECYU"],
  "the-dark-knight": ["EXeTwQWrcwY", "XFXhSBHYKmo", "IJjGybCSI4E"],
  "96": ["zxApO3eWjaU", "B1LxqQFMARA", "VII7hMnJZ9M"],
  "manjummel-boys": ["mSR5jSLPh3s", "3E0lh6dNVfE", "s96ccyOXiOo"],
  "kung-fu-panda-4": ["_wEf-tAs5KU", "INa2scKShM8", "QAJgHQ29CBs"],
};

async function check(id: string): Promise<{ id: string; ok: boolean; title?: string; author?: string }> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { id, ok: false };
    const j = (await res.json()) as { title?: string; author_name?: string };
    return { id, ok: true, title: j.title, author: j.author_name };
  } catch {
    return { id, ok: false };
  }
}

for (const [slug, ids] of Object.entries(CANDIDATES)) {
  for (const id of ids) {
    const r = await check(id);
    console.log(`${slug} | ${id} | ${r.ok ? "OK" : "FAIL"} | ${r.title ?? ""} | ${r.author ?? ""}`);
    if (r.ok) break;
  }
}
export {};
