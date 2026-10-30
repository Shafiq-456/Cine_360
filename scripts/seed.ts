// CINE 360 — seed/demo data.
// Creates labelled demo accounts, 2 theatres, 3 auditoriums, a demo movie
// catalogue (real films, factual metadata, procedural artwork), and shows for
// today + tomorrow with complete per-show seat inventory.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_LAYOUTS, DEFAULT_PRICES, generateLayout } from "../src/lib/geometry";

const db = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";

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
];

async function main() {
  console.log("Seeding CINE 360 demo data…");
  await clean();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- Demo accounts (clearly labelled, do not bypass backend authorization) ----
  const admin = await db.user.create({ data: { email: "admin@cine360.demo", passwordHash, name: "Platform Admin (demo)", role: "ADMIN" } });
  const ownerFrost = await db.user.create({ data: { email: "owner@cine360.demo", passwordHash, name: "Frost Cinemas Owner (demo)", role: "OWNER" } });
  const ownerFlame = await db.user.create({ data: { email: "owner2@cine360.demo", passwordHash, name: "Flame Multiplex Owner (demo)", role: "OWNER" } });
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
  await db.theatreStaff.create({ data: { theatreId: frost.id, userId: staff.id } });
  console.log("✓ theatres (Flame Multiplex intentionally left PENDING for admin approval demo)");

  // ---- Auditoriums ----
  const frostA1 = await createAuditorium(frost.id, "Audi 1 · Grand", DEMO_LAYOUTS.grand);
  const frostA2 = await createAuditorium(frost.id, "Audi 2 · Classic", DEMO_LAYOUTS.classic);
  const flameA1 = await createAuditorium(flame.id, "Audi 1 · Luxe", DEMO_LAYOUTS.luxe);
  console.log(`✓ auditoriums + seats (${frostA1.seatCount}, ${frostA2.seatCount}, ${flameA1.seatCount} seats)`);

  // ---- Movies ----
  const movieRows = await db.$transaction(
    MOVIES.map((m) =>
      db.movie.create({
        data: {
          title: m.title, slug: m.slug, synopsis: m.synopsis,
          posterUrl: `/posters/${m.slug}.svg`, backdropUrl: `/posters/${m.slug}-backdrop.svg`,
          languages: JSON.stringify(m.languages), genres: JSON.stringify(m.genres),
          durationMins: m.durationMins, certification: m.certification,
          releaseDate: new Date(`${m.year}-06-15T00:00:00.000Z`),
          trailerUrl: m.trailerUrl, status: "NOW_SHOWING", featured: m.featured,
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

  // ---- Shows: today + tomorrow, staggered times ----
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const slots = [10 * 60, 13 * 60 + 30, 17 * 60, 20 * 60 + 30]; // minutes from midnight
  let showCount = 0;

  const plan: { movieIdx: number; aud: string; theatreName: string; language: string; format: string }[] = [
    { movieIdx: 0, aud: frostA1.id, theatreName: "frost", language: "English", format: "IMAX 2D" },
    { movieIdx: 4, aud: frostA2.id, theatreName: "frost", language: "Tamil", format: "2D" },
    { movieIdx: 1, aud: frostA1.id, theatreName: "frost", language: "English", format: "3D" },
    { movieIdx: 3, aud: frostA2.id, theatreName: "frost", language: "Hindi", format: "2D" },
    { movieIdx: 5, aud: flameA1.id, theatreName: "flame", language: "Telugu", format: "2D" },
    { movieIdx: 6, aud: flameA1.id, theatreName: "flame", language: "Malayalam", format: "2D" },
  ];

  for (let day = 0; day < 2; day++) {
    const date = new Date(base.getTime() + day * 86400000);
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const slot = slots[(i + day) % slots.length];
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
  }
  console.log(`✓ ${showCount} shows with full per-show seat inventory`);

  // ---- Settings ----
  await db.setting.create({ data: { key: "platform.commissionPercent", value: "8" } });

  console.log("\n──────────────── DEMO ACCOUNTS (all use password: Demo@1234) ────────────────");
  console.log("  admin@cine360.demo    → Super-Admin dashboard");
  console.log("  owner@cine360.demo    → Theatre Owner (Frost Cinemas — APPROVED)");
  console.log("  owner2@cine360.demo   → Theatre Owner (Flame Multiplex — PENDING approval)");
  console.log("  staff@cine360.demo    → Gate Staff (Frost Cinemas) — ticket scanner");
  console.log("  customer@cine360.demo → Customer (demo bookings)");
  console.log("──────────────────────────────────────────────────────────────────────────────");
}

async function createAuditorium(theatreId: string, name: string, layout: typeof DEMO_LAYOUTS.grand) {
  const { seats } = generateLayout(layout);
  const aud = await db.auditorium.create({
    data: {
      theatreId, name, layoutConfig: JSON.stringify(layout), geometrySource: "PROCEDURAL", status: "PUBLISHED",
      categories: {
        create: Object.entries(DEFAULT_PRICES).map(([code, v]) => ({
          code, name: v.name, color: v.color, basePrice: v.price,
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
  // delete in dependency order
  const tables = [
    "ticketValidation", "ticket", "payment", "bookingSeat", "booking", "seatHold",
    "showSeat", "show", "movie", "auditoriumModel", "seat", "seatCategory", "auditorium",
    "theatreStaff", "theatre", "auditLog", "setting", "user",
  ] as const;
  for (const t of tables) {
    // @ts-expect-error dynamic delegate access on typed client
    await db[t].deleteMany({});
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
