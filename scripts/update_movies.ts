// One-off: point movies at real poster art + verified official YouTube trailers.
// Posters: promotional artwork sourced from the public web for this non-commercial
// student demo (credited in the UI as "© respective studios").
// Trailers: verified via YouTube oembed (official uploader channels).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const UPDATES: Record<
  string,
  { poster: string; trailer: string | null }
> = {
  inception: { poster: "/posters/inception.jpg", trailer: "https://www.youtube.com/watch?v=YoHD9XEInc0" },
  interstellar: { poster: "/posters/interstellar.jpg", trailer: "https://www.youtube.com/watch?v=zSWdZVtXT7E" },
  oppenheimer: { poster: "/posters/oppenheimer.jpg", trailer: "https://www.youtube.com/watch?v=uYPbbksJxIg" },
  jawan: { poster: "/posters/jawan.jpg", trailer: "https://www.youtube.com/watch?v=COv52Qyctws" },
  leo: { poster: "/posters/leo.jpg", trailer: "https://www.youtube.com/watch?v=Po3jStA673E" },
  "kalki-2898-ad": { poster: "/posters/kalki-2898-ad.jpg", trailer: "https://www.youtube.com/watch?v=kQDd1AhGIHk" },
  kantara: { poster: "/posters/kantara.jpg", trailer: "https://www.youtube.com/watch?v=8mrVmf239GU" },
  premalu: { poster: "/posters/premalu.jpg", trailer: "https://www.youtube.com/watch?v=rR_2ti4l3nM" },
};

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]v=([\w-]{6,})/);
  return m ? m[1] : null;
}

async function main() {
  for (const [slug, u] of Object.entries(UPDATES)) {
    const data: Record<string, unknown> = { posterUrl: u.poster, backdropUrl: u.poster, trailerUrl: u.trailer };
    const row = await db.movie.update({ where: { slug }, data });
    console.log(`${row.slug}: poster=${row.posterUrl} trailerId=${youtubeId(row.trailerUrl)}`);
  }
  // The in-house demo film keeps its procedural poster; no external trailer.
  await db.movie.update({ where: { slug: "cine360-first-light" }, data: { backdropUrl: "/posters/cine360-first-light.svg" } }).catch(() => {});
  console.log("DONE");
  await db.$disconnect();
}

main();
