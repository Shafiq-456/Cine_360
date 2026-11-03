// Verify YouTube trailer IDs via the official oembed endpoint (returns real uploader titles).
const CANDIDATES: Record<string, string[]> = {
  inception: ["YoHD9XEInc0", "YoHD9XEInc", "R4PmcLQBBtk"],
  interstellar: ["zSWdZVtXT7E", "2LqzF5WauAw"],
  oppenheimer: ["uYPbbksJxIg", "S0aV0dGSbDY"],
  jawan: ["COv52Qyctws", "sDfBsWvWUEA", "h6OrPMHIxUY"],
  leo: ["Y9SiUKu_i-o", "Po3jStA673c", "VKm6XcKoyg8", "dR9JdD5f3a0"],
  "kalki-2898-ad": ["kJBODKwWdm4", "HVmW0i4baik", "G4DEONGPdTU"],
  kantara: ["75TTQMgNabA", "8Klr8ZGeuLo", "wNMNXR5e-fU"],
  premalu: ["k1Dja3E4d9M", "eAsKmBd8CTE", "l7A6xS0H6Q0"],
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

for (const [movie, ids] of Object.entries(CANDIDATES)) {
  for (const id of ids) {
    const r = await check(id);
    console.log(`${movie} | ${id} | ${r.ok ? "OK" : "FAIL"} | ${r.title ?? ""} | ${r.author ?? ""}`);
    if (r.ok) break;
  }
}
