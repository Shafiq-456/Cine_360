// CINE 360 — seed/demo data.
// Creates labelled demo accounts (3 owners), 4 theatres, 8 DISTINCT auditoriums
// (each with its own layout, screen size, seat map and interior theme), a demo
// movie catalogue (16 real films + 1 demo upcoming title, factual metadata,
// real poster artwork with procedural SVG fallbacks, verified trailers), and
// 32 shows for today with complete per-show seat inventory. The rolling
// auto-scheduler keeps the 7-day window filled afterwards.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_LAYOUTS, DEFAULT_PRICES, generateLayout } from "../src/lib/geometry";
import type { LayoutConfig } from "../src/lib/geometry";

const db = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";

// Official trailer YouTube IDs — verified from the films' official channels
// (scripts/verify_trailers.ts + scripts/verify_new_trailers.ts via YouTube oembed).
const TRAILER_ID: Record<string, string> = {
  interstellar: "2LqzF5WauAw",
  inception: "YoHD9XEInc0",
  oppenheimer: "uYPbbksJxIg",
  jawan: "MWOlnZSnXJo",
  leo: "Po3jStA673E",
  "kalki-2898-ad": "kQDd1AhGIHk",
  premalu: "rR_2ti4l3nM",
  kantara: "8mrVmf239GU",
  // 2026-11 expansion
  rrr: "f_vbAtFSEc0",
  vikram: "OKBMCL-frPU",
  "3-idiots": "K0eDlFX9GMc",
  "dune-part-two": "Way9Dexny3w",
  "the-dark-knight": "EXeTwQWrcwY",
  "96": "r0synl-lI4I",
  "manjummel-boys": "id848Ww1YLo",
  "kung-fu-panda-4": "_inKs4eeHiI",
};

import { existsSync } from "fs";
import path from "path";
function posterPath(slug: string, variant: "" | "-backdrop"): string {
  const jpg = path.join(process.cwd(), "public", "posters", `${slug}${variant}.jpg`);
  return existsSync(jpg) ? `/posters/${slug}${variant}.jpg` : `/posters/${slug}${variant}.svg`;
}

const MOVIES = [
  { title: "Interstellar", slug: "interstellar", languages: ["English"], genres: ["Sci-Fi", "Adventure", "Drama"], durationMins: 169, certification: "UA", year: 2014, featured: true,
    synopsis: "When Earth becomes uninhabitable, a farmer and ex-NASA pilot is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.",
    trailerUrl: "https://www.youtube.com/results?search_query=interstellar+official+trailer" },
  { title: "Inception", slug: "inception", languages: ["English"], genres: ["Sci-Fi", "Action", "Thriller"], durationMins: 148, certification: "UA", year: 2010, featured: true,
    synopsis: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    trailerUrl: "https://www.youtube.com/results?search_query=inception+official+trailer" },
  { title: "Oppenheimer", slug: "oppenheimer", languages: ["English"], genres: ["Drama", "History", "Thriller"], durationMins: 180, certification: "UA", year: 2023, featured: true,
    synopsis: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II — and the fallout that followed.",
    trailerUrl: "https://www.youtube.com/results?search_query=oppenheimer+official+trailer" },
  { title: "Jawan", slug: "jawan", languages: ["Hindi"], genres: ["Action", "Thriller"], durationMins: 169, certification: "UA", year: 2023, featured: false,
    synopsis: "A high-octane action thriller that outlines the story of a man driven by personal vendetta to rectify the wrongs in society.",
    trailerUrl: "https://www.youtube.com/results?search_query=jawan+official+trailer" },
  { title: "Leo", slug: "leo", languages: ["Tamil"], genres: ["Action", "Thriller", "Drama"], durationMins: 164, certification: "UA", year: 2023, featured: true,
    synopsis: "A mild-mannered cafe owner in Kashmir's Theog is forced to confront his violent past when gangsters come looking for him.",
    trailerUrl: "https://www.youtube.com/results?search_query=leo+tamil+official+trailer" },
  { title: "Kalki 2898 AD", slug: "kalki-2898-ad", languages: ["Telugu", "Hindi", "Tamil"], genres: ["Sci-Fi", "Action", "Fantasy"], durationMins: 181, certification: "UA", year: 2024, featured: false,
    synopsis: "A modern-day avatar of Vishnu, believed to have descended to protect the world from evil forces, rises in a dystopian future.",
    trailerUrl: "https://www.youtube.com/results?search_query=kalki+2898+ad+official+trailer" },
  { title: "Premalu", slug: "premalu", languages: ["Malayalam"], genres: ["Romance", "Comedy"], durationMins: 156, certification: "U", year: 2024, featured: false,
    synopsis: "A young man's plans to move abroad go awry when he falls in love in Hyderabad in this feel-good romantic comedy.",
    trailerUrl: "https://www.youtube.com/results?search_query=premalu+official+trailer" },
  { title: "Kantara", slug: "kantara", languages: ["Kannada"], genres: ["Action", "Thriller", "Drama"], durationMins: 148, certification: "UA", year: 2022, featured: false,
    synopsis: "A fiery young man clashes with an unscrupulous police officer in a coastal village where nature and tradition collide.",
    trailerUrl: "https://www.youtube.com/results?search_query=kantara+official+trailer" },
  // ---- 2026-11 expansion: 8 additional titles ----
  { title: "RRR", slug: "rrr", languages: ["Telugu", "Hindi", "Tamil"], genres: ["Action", "Drama", "Adventure"], durationMins: 187, certification: "UA", year: 2022, featured: true,
    synopsis: "A fearless revolutionary and an officer of the British colonial army, unaware of each other's true identities, join forces in a mission — then clash in an epic tale of friendship.",
    trailerUrl: "https://www.youtube.com/results?search_query=rrr+official+trailer" },
  { title: "Vikram", slug: "vikram", languages: ["Tamil", "Hindi"], genres: ["Action", "Thriller", "Crime"], durationMins: 175, certification: "UA", year: 2022, featured: false,
    synopsis: "A special agent investigates a masked vigilante gang's murders, unearthing a conspiracy that ties back to a legendary black-ops operative presumed dead.",
    trailerUrl: "https://www.youtube.com/results?search_query=vikram+official+trailer" },
  { title: "3 Idiots", slug: "3-idiots", languages: ["Hindi"], genres: ["Comedy", "Drama"], durationMins: 170, certification: "U", year: 2009, featured: false,
    synopsis: "Two friends search for their long-lost college companion, a free spirit whose unconventional outlook on education and life changed theirs forever.",
    trailerUrl: "https://www.youtube.com/results?search_query=3+idiots+official+trailer" },
  { title: "Dune: Part Two", slug: "dune-part-two", languages: ["English"], genres: ["Sci-Fi", "Adventure", "Drama"], durationMins: 166, certification: "UA", year: 2024, featured: true,
    synopsis: "Paul Atreides unites with the Fremen while on a warpath of revenge against the conspirators who destroyed his family — torn between the love of his life and the fate of the universe.",
    trailerUrl: "https://www.youtube.com/results?search_query=dune+part+two+official+trailer" },
  { title: "The Dark Knight", slug: "the-dark-knight", languages: ["English"], genres: ["Action", "Crime", "Drama"], durationMins: 152, certification: "UA", year: 2008, featured: false,
    synopsis: "Batman's fight against the Joker — a criminal mastermind who plunges Gotham City into anarchy and pushes the Dark Knight closer to crossing the line between hero and vigilante.",
    trailerUrl: "https://www.youtube.com/results?search_query=the+dark+knight+official+trailer" },
  { title: "96", slug: "96", languages: ["Tamil"], genres: ["Romance", "Drama", "Music"], durationMins: 158, certification: "U", year: 2018, featured: false,
    synopsis: "Two high-school sweethearts from the batch of 1996 meet at a class reunion 22 years later and spend one unforgettable evening reliving their past.",
    trailerUrl: "https://www.youtube.com/results?search_query=96+tamil+official+trailer" },
  { title: "Manjummel Boys", slug: "manjummel-boys", languages: ["Malayalam"], genres: ["Thriller", "Drama", "Survival"], durationMins: 135, certification: "UA", year: 2024, featured: false,
    synopsis: "A group of friends on a trip to Kodaikanal descend into the Guna Caves to save one of their own — a daring real-life-inspired rescue.",
    trailerUrl: "https://www.youtube.com/results?search_query=manjummel+boys+official+trailer" },
  { title: "Kung Fu Panda 4", slug: "kung-fu-panda-4", languages: ["English", "Hindi"], genres: ["Animation", "Action", "Comedy"], durationMins: 94, certification: "U", year: 2024, featured: false,
    synopsis: "Po must train a new Dragon Warrior while facing the shape-shifting Chameleon, who covets his Staff of Wisdom — with a quick-witted fox thief at his side.",
    trailerUrl: "https://www.youtube.com/results?search_query=kung+fu+panda+4+official+trailer" },
];

async function main() {
  console.log("Seeding CINE 360 demo data…");
  await clean();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- Demo accounts (clearly labelled, do not bypass backend authorization) ----
  const admin = await db.user.create({ data: { email: "admin@cine360.demo", passwordHash, name: "Platform Admin (demo)", role: "ADMIN" } });
  const ownerFrost = await db.user.create({ data: { email: "owner@cine360.demo", passwordHash, name: "Frost Cinemas Owner (demo)", role: "OWNER" } });
  const ownerFlame = await db.user.create({ data: { email: "owner2@cine360.demo", passwordHash, name: "Flame Multiplex Owner (demo)", role: "OWNER" } });
  const ownerAurora = await db.user.create({ data: { email: "owner3@cine360.demo", passwordHash, name: "Aurora Group Owner (demo)", role: "OWNER" } });
  const staff = await db.user.create({ data: { email: "staff@cine360.demo", passwordHash, name: "Gate Staff (demo)", role: "STAFF" } });
  const customer = await db.user.create({ data: { email: "customer@cine360.demo", passwordHash, name: "Riya Kumar (demo)", role: "CUSTOMER" } });
  console.log("✓ demo users");

  // ---- Theatres ----
  const frost = await db.theatre.create({
    data: {
      ownerId: ownerFrost.id, name: "Frost Cinemas — City Centre", city: "Chennai",
      address: "14 Anna Salai, Chennai 600002", amenities: JSON.stringify(["4K Laser Projection", "Dolby Atmos", "Recliners", "Cafe", "Parking"]),
      status: "APPROVED",
    },
  });
  const flame = await db.theatre.create({
    data: {
      ownerId: ownerFlame.id, name: "Flame Multiplex — Brookefields", city: "Coimbatore",
      address: " Brookefields Mall, Krishnasamy Road, Coimbatore 641001", amenities: JSON.stringify(["IMAX-style Screen", "Dolby 7.1", "Valet Parking"]),
      status: "PENDING", // left pending so the super-admin approval flow can be demonstrated
    },
  });
  const pearl = await db.theatre.create({
    data: {
      ownerId: ownerFrost.id, name: "Pearl Screens — T. Nagar", city: "Chennai",
      address: "45 Usman Road, T. Nagar, Chennai 600017", amenities: JSON.stringify(["Single-screen Heritage Hall", "Dolby Digital", "Family Combos", "Parking"]),
      status: "APPROVED",
    },
  });
  const aurora = await db.theatre.create({
    data: {
      ownerId: ownerAurora.id, name: "Aurora Cineplex — VR Chennai", city: "Chennai",
      address: "VR Chennai, 100 Feet Road, Anna Nagar, Chennai 600040", amenities: JSON.stringify(["Giant-Screen Hall", "Fan-shaped Atrium", "Boutique Screening Lounge", "Dolby Atmos", "Cafe", "Valet Parking"]),
      status: "APPROVED",
    },
  });
  await db.theatreStaff.create({ data: { theatreId: frost.id, userId: staff.id } });
  console.log("✓ theatres (Flame Multiplex intentionally left PENDING for admin approval demo)");

  // ---- Auditoriums — every hall has its OWN layout, screen size and interior theme ----
  const frostA1 = await createAuditorium(frost.id, "Audi 1 · Grand", DEMO_LAYOUTS.grand);
  const frostA2 = await createAuditorium(frost.id, "Audi 2 · Classic", DEMO_LAYOUTS.classic);
  const flameA1 = await createAuditorium(flame.id, "Audi 1 · Luxe", DEMO_LAYOUTS.luxe, { SILVER: 220, GOLD: 320, RECLINER: 520 });
  const pearlA1 = await createAuditorium(pearl.id, "Audi 1 · Retro Single Screen", DEMO_LAYOUTS.retro, { SILVER: 120, GOLD: 190, RECLINER: 280 });
  const pearlA2 = await createAuditorium(pearl.id, "Audi 2 · Family", DEMO_LAYOUTS.family, { SILVER: 140, GOLD: 200, RECLINER: 300 });
  const auroraA1 = await createAuditorium(aurora.id, "Audi 1 · IMAX Experience", DEMO_LAYOUTS.imax, { SILVER: 240, GOLD: 340, RECLINER: 480 });
  const auroraA2 = await createAuditorium(aurora.id, "Audi 2 · Atrium Fan", DEMO_LAYOUTS.fan, { SILVER: 160, GOLD: 240, RECLINER: 380 });
  const auroraA3 = await createAuditorium(aurora.id, "Audi 3 · Boutique Lounge", DEMO_LAYOUTS.boutique, { RECLINER: 650 });
  console.log(
    `✓ 8 auditoriums + seats (grand ${frostA1.seatCount}, classic ${frostA2.seatCount}, luxe ${flameA1.seatCount}, retro ${pearlA1.seatCount}, family ${pearlA2.seatCount}, imax ${auroraA1.seatCount}, fan ${auroraA2.seatCount}, boutique ${auroraA3.seatCount})`
  );

  // ---- Movies ----
  const movieRows = await db.$transaction(
    MOVIES.map((m) =>
      db.movie.create({
        data: {
          title: m.title, slug: m.slug, synopsis: m.synopsis,
          posterUrl: posterPath(m.slug, ""), backdropUrl: posterPath(m.slug, "-backdrop"),
          languages: JSON.stringify(m.languages), genres: JSON.stringify(m.genres),
          durationMins: m.durationMins, certification: m.certification,
          releaseDate: new Date(`${m.year}-06-15T00:00:00.000Z`),
          trailerUrl: m.trailerUrl, trailerId: TRAILER_ID[m.slug] ?? null, status: "NOW_SHOWING", featured: m.featured,
        },
      })
    )
  );
  const upcoming = await db.movie.create({
    data: {
      title: "CINE 360 Original: First Light", slug: "cine360-first-light", synopsis: "A demonstration upcoming title for the CINE 360 platform. This entry exists to showcase the 'Upcoming releases' rail.",
      posterUrl: "/posters/interstellar.svg", languages: JSON.stringify(["English"]), genres: JSON.stringify(["Demo"]),
      durationMins: 120, certification: "UA", trailerUrl: "https://www.youtube.com/results?search_query=cinema+trailer",
      status: "UPCOMING", featured: false,
    },
  });
  console.log(`✓ ${movieRows.length + 1} movies`);

  // ---- Shows: today, staggered times across every auditorium ----
  // (the rolling auto-scheduler in src/lib/schedule.ts then keeps a 7-day
  //  window filled for every PUBLISHED auditorium in APPROVED theatres)
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const slots = [10 * 60, 13 * 60 + 30, 17 * 60, 20 * 60 + 30]; // minutes from midnight
  let showCount = 0;

  // Every auditorium gets 4 showtimes today — 32 shows with full seat inventory.
  const plan: { movieIdx: number; aud: string; language: string; format: string }[] = [
    // Frost Cinemas — City Centre (grand 206 · emerald, classic 140 · teal)
    { movieIdx: 0, aud: frostA1.id, language: "English", format: "IMAX 2D" },  // Interstellar
    { movieIdx: 1, aud: frostA1.id, language: "English", format: "3D" },        // Inception
    { movieIdx: 2, aud: frostA1.id, language: "English", format: "2D" },        // Oppenheimer
    { movieIdx: 12, aud: frostA1.id, language: "English", format: "2D" },       // The Dark Knight
    { movieIdx: 4, aud: frostA2.id, language: "Tamil", format: "2D" },          // Leo
    { movieIdx: 3, aud: frostA2.id, language: "Hindi", format: "2D" },          // Jawan
    { movieIdx: 9, aud: frostA2.id, language: "Tamil", format: "2D" },          // Vikram
    { movieIdx: 10, aud: frostA2.id, language: "Hindi", format: "2D" },         // 3 Idiots
    // Pearl Screens — T. Nagar (retro 320 · crimson, family 140 · copper)
    { movieIdx: 8, aud: pearlA1.id, language: "Telugu", format: "2D" },         // RRR
    { movieIdx: 10, aud: pearlA1.id, language: "Hindi", format: "2D" },         // 3 Idiots
    { movieIdx: 3, aud: pearlA1.id, language: "Hindi", format: "2D" },          // Jawan
    { movieIdx: 5, aud: pearlA1.id, language: "Telugu", format: "2D" },         // Kalki 2898 AD
    { movieIdx: 15, aud: pearlA2.id, language: "English", format: "3D" },       // Kung Fu Panda 4
    { movieIdx: 6, aud: pearlA2.id, language: "Malayalam", format: "2D" },      // Premalu
    { movieIdx: 13, aud: pearlA2.id, language: "Tamil", format: "2D" },         // 96
    { movieIdx: 14, aud: pearlA2.id, language: "Malayalam", format: "2D" },     // Manjummel Boys
    // Aurora Cineplex — VR Chennai (imax 216 · azure, fan 144 · rose, boutique 48 · violet)
    { movieIdx: 11, aud: auroraA1.id, language: "English", format: "IMAX 2D" }, // Dune: Part Two
    { movieIdx: 0, aud: auroraA1.id, language: "English", format: "IMAX 2D" },  // Interstellar
    { movieIdx: 2, aud: auroraA1.id, language: "English", format: "IMAX 2D" },  // Oppenheimer
    { movieIdx: 8, aud: auroraA1.id, language: "Telugu", format: "IMAX 2D" },   // RRR
    { movieIdx: 5, aud: auroraA2.id, language: "Telugu", format: "3D" },        // Kalki 2898 AD
    { movieIdx: 9, aud: auroraA2.id, language: "Tamil", format: "2D" },         // Vikram
    { movieIdx: 7, aud: auroraA2.id, language: "Kannada", format: "2D" },       // Kantara
    { movieIdx: 4, aud: auroraA2.id, language: "Tamil", format: "2D" },         // Leo
    { movieIdx: 13, aud: auroraA3.id, language: "Tamil", format: "2D" },        // 96
    { movieIdx: 6, aud: auroraA3.id, language: "Malayalam", format: "2D" },     // Premalu
    { movieIdx: 11, aud: auroraA3.id, language: "English", format: "2D" },      // Dune: Part Two
    { movieIdx: 1, aud: auroraA3.id, language: "English", format: "2D" },       // Inception
    // Flame Multiplex — Brookefields (luxe 88 · amber) — theatre is PENDING, hidden from customers
    { movieIdx: 6, aud: flameA1.id, language: "Malayalam", format: "2D" },      // Premalu
    { movieIdx: 5, aud: flameA1.id, language: "Telugu", format: "2D" },         // Kalki 2898 AD
    { movieIdx: 7, aud: flameA1.id, language: "Kannada", format: "2D" },        // Kantara
    { movieIdx: 14, aud: flameA1.id, language: "Malayalam", format: "2D" },     // Manjummel Boys
  ];

  const date = new Date(base.getTime());
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const slot = slots[i % slots.length];
    const startsAt = new Date(date.getTime() + slot * 60000);
    const movie = movieRows[p.movieIdx];
    const audRow = await db.auditorium.findUnique({ where: { id: p.aud }, include: { categories: true, seats: { include: { category: true } } } });
    if (!audRow) continue;
    const show = await db.show.create({
      data: {
        movieId: movie.id, auditoriumId: p.aud, startsAt, language: p.language, format: p.format, status: "SCHEDULED",
      },
    });
    // Per-show seat inventory priced by category (show-specific, separate from physical seats)
    const seatRows = audRow.seats.map((s) => ({
      showId: show.id, seatId: s.id, status: "AVAILABLE", price: s.category.basePrice,
    }));
    // chunk inserts to stay within SQLite parameter limits
    for (let c = 0; c < seatRows.length; c += 60) {
      await db.showSeat.createMany({ data: seatRows.slice(c, c + 60) });
    }
    showCount++;
  }
  console.log(`✓ ${showCount} shows today with full per-show seat inventory (scheduler keeps the 7-day window rolling)`);

  // ---- Settings ----
  await db.setting.create({ data: { key: "platform.commissionPercent", value: "8" } });

  console.log("\n──────────────── DEMO ACCOUNTS (all use password: Demo@1234) ────────────────");
  console.log("  admin@cine360.demo    → Super-Admin dashboard");
  console.log("  owner@cine360.demo    → Theatre Owner (Frost Cinemas + Pearl Screens — APPROVED)");
  console.log("  owner2@cine360.demo   → Theatre Owner (Flame Multiplex — PENDING approval)");
  console.log("  owner3@cine360.demo   → Theatre Owner (Aurora Cineplex — APPROVED)");
  console.log("  staff@cine360.demo    → Gate Staff (Frost Cinemas) — ticket scanner");
  console.log("  customer@cine360.demo → Customer (demo bookings)");
  console.log("──────────────────────────────────────────────────────────────────────────────");
}

async function createAuditorium(theatreId: string, name: string, layout: LayoutConfig, priceOverrides?: Record<string, number>) {
  const { seats } = generateLayout(layout);
  const aud = await db.auditorium.create({
    data: {
      theatreId, name, layoutConfig: JSON.stringify(layout), geometrySource: "PROCEDURAL", status: "PUBLISHED",
      categories: {
        create: Object.entries(DEFAULT_PRICES).map(([code, v]) => ({
          code, name: v.name, color: v.color, basePrice: priceOverrides?.[code] ?? v.price,
        })),
      },
      models: {
        create: {
          kind: "PROCEDURAL", status: "PUBLISHED", version: 1,
          notes: "Procedural demonstration geometry generated from the auditorium layout configuration. Not a calibrated survey of a real auditorium.",
        },
      },
    },
    include: { categories: true },
  });
  const catByCode = new Map(aud.categories.map((c) => [c.code, c.id]));
  await db.seat.createMany({
    data: seats.map((s) => ({
      auditoriumId: aud.id, rowLabel: s.rowLabel, seatNumber: s.seatNumber, rowIndex: s.rowIndex, colIndex: s.colIndex,
      x: s.x, z: s.z, baseY: s.baseY, eyeHeight: s.eyeHeight, categoryId: catByCode.get(s.categoryCode)!,
      isAccessible: s.isAccessible,
    })),
  });
  return { id: aud.id, seatCount: seats.length };
}

async function clean() {
  // delete in dependency order (typed delegates, no dynamic indexing)
  const delegates = [
    db.ticketValidation, db.ticket, db.payment, db.bookingSeat, db.booking, db.seatHold,
    db.showSeat, db.show, db.movie, db.auditoriumModel, db.seat, db.seatCategory, db.auditorium,
    db.theatreStaff, db.theatre, db.auditLog, db.setting, db.user,
  ];
  for (const t of delegates) {
    await (t as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
