// CINE 360 — seed/demo data.
// Creates labelled demo accounts (7 owners), 15 theatres across 12 cities
// (Chennai, Bengaluru, Hyderabad, Mumbai, Madurai, Coimbatore, Delhi, Kolkata,
// Pune, Kochi, Jaipur) with 21 DISTINCT auditoriums (each with its own layout,
// screen size, seat map and interior theme), a demo movie catalogue (46 films —
// 28 established favourites and 18 new 2026 releases — with factual metadata
// where published, procedural SVG fallback artwork, search-link trailers), and
// 84 shows for today with complete per-show seat inventory. The rolling
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
  // 2026-11 second expansion — all validated live via YouTube oembed
  pathaan: "vqu4z34wENw",
  brahmastra: "BUjXzrgntcY",
  "baahubali-2": "G62HrubdD6o",
  "sita-ramam": "3UKsbXQUwqw",
  "ponniyin-selvan-1": "D4qAQYlgZQs",
  "jai-bhim": "nnXpbTFrqXA",
  tumbbad: "YGIcZrUBY0k",
  andhadhun: "2iVYI99VGaw",
  "drishyam-2": "cxA2y9Tgl7o",
  "zindagi-na-milegi-dobara": "FJrpcDgC3zU",
  queen: "M_HP8xgXhBU",
  "super-deluxe": "3-Xq_Zz3nPA",
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
  // ---- 2026-11 second expansion: 12 additional titles ----
  { title: "Pathaan", slug: "pathaan", languages: ["Hindi"], genres: ["Action", "Thriller"], durationMins: 146, certification: "UA", year: 2023, featured: false,
    synopsis: "A disgraced raw agent returns from the dead to stop a private mercenary from unleashing a devastating attack on India.",
    trailerUrl: "https://www.youtube.com/results?search_query=pathaan+official+trailer" },
  { title: "Brahmāstra: Part One – Shiva", slug: "brahmastra", languages: ["Hindi"], genres: ["Fantasy", "Adventure", "Romance"], durationMins: 167, certification: "UA", year: 2022, featured: false,
    synopsis: "A young DJ discovers he commands fire and shares a bond with the ancient astras — drawing him into an ancient battle against a rising dark force.",
    trailerUrl: "https://www.youtube.com/results?search_query=brahmastra+official+trailer" },
  { title: "Baahubali 2: The Conclusion", slug: "baahubali-2", languages: ["Telugu", "Hindi", "Tamil"], genres: ["Action", "Drama", "Epic"], durationMins: 171, certification: "UA", year: 2017, featured: true,
    synopsis: "Amarendra Baahubali's rise, love and betrayal finally answer the question that gripped a nation — why did Kattappa kill Baahubali?",
    trailerUrl: "https://www.youtube.com/results?search_query=baahubali+2+official+trailer" },
  { title: "Sita Ramam", slug: "sita-ramam", languages: ["Telugu", "Malayalam", "Tamil"], genres: ["Romance", "Drama"], durationMins: 163, certification: "U", year: 2022, featured: false,
    synopsis: "A soldier receives a mysterious letter and a love that spans two decades — a poignant tale of devotion, identity and sacrifice.",
    trailerUrl: "https://www.youtube.com/results?search_query=sita+ramam+official+trailer" },
  { title: "Ponniyin Selvan: Part I", slug: "ponniyin-selvan-1", languages: ["Tamil"], genres: ["Action", "Adventure", "Drama"], durationMins: 167, certification: "UA", year: 2022, featured: false,
    synopsis: "The Chola empire's succession hangs by a thread as princes, ministers and spies conspire in Kalki's epic adaptation of a legendary novel.",
    trailerUrl: "https://www.youtube.com/results?search_query=ponniyin+selvan+part+1+official+trailer" },
  { title: "Jai Bhim", slug: "jai-bhim", languages: ["Tamil"], genres: ["Drama", "Courtroom"], durationMins: 164, certification: "UA", year: 2021, featured: false,
    synopsis: "When a tribal man vanishes in police custody, lawyer Chandru fights a landmark battle for justice in this real-life-inspired courtroom drama.",
    trailerUrl: "https://www.youtube.com/results?search_query=jai+bhim+official+trailer" },
  { title: "Tumbbad", slug: "tumbbad", languages: ["Hindi"], genres: ["Horror", "Fantasy", "Period"], durationMins: 122, certification: "UA", year: 2018, featured: false,
    synopsis: "In rain-soaked Tumbbad, a cursed treasure guards a hungry god — a mythic fable of greed passed down generations.",
    trailerUrl: "https://www.youtube.com/results?search_query=tumbbad+official+trailer" },
  { title: "Andhadhun", slug: "andhadhun", languages: ["Hindi"], genres: ["Thriller", "Comedy", "Crime"], durationMins: 139, certification: "UA", year: 2018, featured: false,
    synopsis: "A blind pianist becomes the only witness to a murder — or is he? A deliciously twisty game of cat and mouse follows.",
    trailerUrl: "https://www.youtube.com/results?search_query=andhadhun+official+trailer" },
  { title: "Drishyam 2", slug: "drishyam-2", languages: ["Hindi"], genres: ["Thriller", "Drama"], durationMins: 135, certification: "UA", year: 2022, featured: false,
    synopsis: "Years after the case went quiet, Vijay Salgaonkar's carefully protected secret begins to resurface — and this time the truth is closing in.",
    trailerUrl: "https://www.youtube.com/results?search_query=drishyam+2+official+trailer" },
  { title: "Zindagi Na Milegi Dobara", slug: "zindagi-na-milegi-dobara", languages: ["Hindi"], genres: ["Comedy", "Drama", "Adventure"], durationMins: 155, certification: "UA", year: 2011, featured: false,
    synopsis: "Three friends reunite for a bachelor road trip across Spain that turns into the journey of a lifetime — diving, running with bulls and healing old wounds.",
    trailerUrl: "https://www.youtube.com/results?search_query=zindagi+na+milegi+dobara+official+trailer" },
  { title: "Queen", slug: "queen", languages: ["Hindi"], genres: ["Comedy", "Drama"], durationMins: 146, certification: "UA", year: 2013, featured: false,
    synopsis: "When her wedding falls apart, Rani sets off on her honeymoon alone — and comes back a completely different woman.",
    trailerUrl: "https://www.youtube.com/results?search_query=queen+2013+official+trailer" },
  { title: "Super Deluxe", slug: "super-deluxe", languages: ["Tamil"], genres: ["Drama", "Anthology"], durationMins: 176, certification: "UA", year: 2019, featured: false,
    synopsis: "Several parallel lives — a lost lover, an unsatisfied wife, a boy and his absent father — collide over one eventful day in Chennai.",
    trailerUrl: "https://www.youtube.com/results?search_query=super+deluxe+2019+official+trailer" },
  // ---- 2026-11 third expansion: 18 new releases (user-supplied list) ----
  // Metadata sourced from public listings where available (Wikipedia/IMDb/BookMyShow,
  // Nov 2026); runtime/cert marked est. where not yet published. trailerId left null
  // (no verified embed IDs) — the search-link trailerUrl is shown instead.
  { title: "Ramayana: Rise of a Legend", slug: "ramayana-rise-of-a-legend", languages: ["Hindi", "Tamil", "Telugu"], genres: ["Mythological", "Epic", "Drama"], durationMins: 195, certification: "UA", year: 2026, featured: true,
    synopsis: "Adapted from Valmiki's epic, part one of the two-part saga follows Prince Rama's marriage, exile and the beginning of a legendary journey — with music by Hans Zimmer and A. R. Rahman.",
    trailerUrl: "https://www.youtube.com/results?search_query=ramayana+rise+of+a+legend+official+trailer" },
  { title: "Nakhrewaalii", slug: "nakhrewaalii", languages: ["Hindi"], genres: ["Comedy", "Romance"], durationMins: 129, certification: "A", year: 2026, featured: false,
    synopsis: "A small-town Hindi romantic comedy about big dreams and bigger attitude, presented by Aanand L Rai's Colour Yellow Productions.",
    trailerUrl: "https://www.youtube.com/results?search_query=nakhrewaalii+official+trailer" },
  { title: "Pyre", slug: "pyre", languages: ["Hindi", "Kumaoni"], genres: ["Drama"], durationMins: 115, certification: "UA", year: 2026, featured: false,
    synopsis: "Vinod Kapri's quiet, devastating tale of an elderly couple's undying love in a dying Himalayan village — the festival favourite finally reaches Indian cinemas.",
    trailerUrl: "https://www.youtube.com/results?search_query=pyre+chita+official+trailer" },
  { title: "Gajab Raat", slug: "gajab-raat", languages: ["Hindi"], genres: ["Thriller", "Crime"], durationMins: 123, certification: "UA", year: 2026, featured: false,
    synopsis: "A corrupt, troubled cop's night spirals out of control when one reluctant act of mercy pulls him into a deadly web of crime, in this single-night suspense thriller.",
    trailerUrl: "https://www.youtube.com/results?search_query=gajab+raat+official+trailer" },
  { title: "Mirzapur: The Movie", slug: "mirzapur-the-movie", languages: ["Hindi", "Telugu"], genres: ["Action", "Crime", "Drama"], durationMins: 197, certification: "A", year: 2026, featured: true,
    synopsis: "Kaleen Bhaiyya, Guddu and Munna return in an interquel set during the first season of the cult series — power, opium and betrayal in the badlands of Purvanchal.",
    trailerUrl: "https://www.youtube.com/results?search_query=mirzapur+the+movie+official+trailer" },
  { title: "Paradise Lost", slug: "paradise-lost", languages: ["Korean"], genres: ["Thriller", "Mystery"], durationMins: 120, certification: "UA", year: 2026, featured: false,
    synopsis: "Yeon Sang-ho's psychological thriller, adapted from the novel Black Inferno, follows a mind unravelling at the border between paradise and inferno.",
    trailerUrl: "https://www.youtube.com/results?search_query=paradise+lost+yeon+sang+ho+official+trailer" },
  { title: "Raise the Red Lantern", slug: "raise-the-red-lantern", languages: ["Mandarin"], genres: ["Drama", "Period"], durationMins: 125, certification: "UA", year: 2026, featured: false,
    synopsis: "Zhang Yimou's 1991 masterpiece returns to the big screen in a 2026 re-release — a young woman becomes the fourth wife of a wealthy 1920s household where the lanterns decide everything.",
    trailerUrl: "https://www.youtube.com/results?search_query=raise+the+red+lantern+trailer" },
  { title: "Nurture", slug: "nurture", languages: ["English"], genres: ["Horror", "Drama"], durationMins: 95, certification: "A", year: 2026, featured: false,
    synopsis: "A dialogue-free folk-horror fable: on a remote Oregon farm, a grieving couple pins their hopes on a mysterious flower — and it takes root.",
    trailerUrl: "https://www.youtube.com/results?search_query=nurture+folk+horror+film+trailer" },
  { title: "Scene", slug: "scene", languages: ["Tamil"], genres: ["Drama"], durationMins: 135, certification: "UA", year: 2026, featured: false,
    synopsis: "A 2026 Tamil drama from the fresh-release slate, centred on the moments that become the defining scenes of a life.",
    trailerUrl: "https://www.youtube.com/results?search_query=scene+tamil+movie+trailer" },
  { title: "Mookuthi Amman 2", slug: "mookuthi-amman-2", languages: ["Tamil"], genres: ["Fantasy", "Drama"], durationMins: 150, certification: "UA", year: 2026, featured: false,
    synopsis: "The goddess returns: a queen sacrifices herself to save her son from invaders, and Mookuthi Amman descends to confront a mysterious new evil power — Nayanthara in a dual avatar.",
    trailerUrl: "https://www.youtube.com/results?search_query=mookuthi+amman+2+official+trailer" },
  { title: "Jailer 2", slug: "jailer-2", languages: ["Tamil", "Telugu", "Hindi", "Kannada"], genres: ["Action", "Thriller"], durationMins: 165, certification: "UA", year: 2026, featured: true,
    synopsis: "Tiger Muthuvel Pandian's peaceful retirement is shattered when a dangerous syndicate threatens his family — the one-man army returns, with Mohanlal, Shivarajkumar and Jackie Shroff.",
    trailerUrl: "https://www.youtube.com/results?search_query=jailer+2+official+trailer" },
  { title: "Karuppu", slug: "karuppu", languages: ["Tamil"], genres: ["Fantasy", "Action", "Drama"], durationMins: 152, certification: "UA", year: 2026, featured: true,
    synopsis: "The guardian deity Vettai Karuppu walks into a corrupt courtroom disguised as a young lawyer to fight for a family stripped of everything — Suriya in RJ Balaji's fantasy action drama.",
    trailerUrl: "https://www.youtube.com/results?search_query=karuppu+tamil+official+trailer" },
  { title: "Vishwanath & Sons", slug: "vishwanath-and-sons", languages: ["Tamil"], genres: ["Drama", "Family"], durationMins: 140, certification: "UA", year: 2026, featured: false,
    synopsis: "A 2026 Tamil family drama about legacy, craft and the ties that bind a household whose name is its promise.",
    trailerUrl: "https://www.youtube.com/results?search_query=vishwanath+and+sons+tamil+movie+trailer" },
  { title: "Mandaadi", slug: "mandaadi", languages: ["Tamil"], genres: ["Drama", "Action"], durationMins: 145, certification: "UA", year: 2026, featured: false,
    synopsis: "A seasoned fishing captain leads his six-member crew into a traditional boat race along Tamil Nadu's coast, where the sea alone decides who is king.",
    trailerUrl: "https://www.youtube.com/results?search_query=mandaadi+official+trailer" },
  { title: "Thaai Kizhavi", slug: "thaai-kizhavi", languages: ["Tamil"], genres: ["Drama"], durationMins: 130, certification: "UA", year: 2026, featured: false,
    synopsis: "A 2026 Tamil drama that salutes motherhood — a mother's love stretched to its farthest limits.",
    trailerUrl: "https://www.youtube.com/results?search_query=thaai+kizhavi+tamil+movie+trailer" },
  { title: "Haiku", slug: "haiku", languages: ["Tamil"], genres: ["Drama"], durationMins: 125, certification: "U", year: 2026, featured: false,
    synopsis: "A 2026 Tamil drama told with the quiet brevity of its namesake — small moments, vast feelings.",
    trailerUrl: "https://www.youtube.com/results?search_query=haiku+tamil+movie+trailer" },
  { title: "Dorothy", slug: "dorothy", languages: ["Tamil"], genres: ["Drama", "Thriller"], durationMins: 128, certification: "UA", year: 2026, featured: false,
    synopsis: "A 2026 Tamil thriller that follows its title character down a trail where nothing is quite what it seems.",
    trailerUrl: "https://www.youtube.com/results?search_query=dorothy+tamil+movie+trailer" },
  { title: "Sardar 2", slug: "sardar-2", languages: ["Tamil"], genres: ["Action", "Thriller"], durationMins: 179, certification: "UA", year: 2026, featured: false,
    synopsis: "RAW's 1981 Black Operation returns with a threat to 1.4 billion lives — Karthi reprises his dual role as the spy saga continues.",
    trailerUrl: "https://www.youtube.com/results?search_query=sardar+2+official+trailer" },
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
  const ownerLumiere = await db.user.create({ data: { email: "owner4@cine360.demo", passwordHash, name: "Lumière Group Owner (demo)", role: "OWNER" } });
  const ownerMeridian = await db.user.create({ data: { email: "owner5@cine360.demo", passwordHash, name: "Meridian Cinemas Owner (demo)", role: "OWNER" } });
  const ownerCapital = await db.user.create({ data: { email: "owner6@cine360.demo", passwordHash, name: "Capital Films Owner (demo)", role: "OWNER" } });
  const ownerEastern = await db.user.create({ data: { email: "owner7@cine360.demo", passwordHash, name: "Eastern Cinemas Owner (demo)", role: "OWNER" } });
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
  // ---- 2026-11 city expansion: Bengaluru, Hyderabad, Mumbai, Madurai ----
  const lumiere = await db.theatre.create({
    data: {
      ownerId: ownerLumiere.id, name: "Lumière Cinemas — Indiranagar", city: "Bengaluru",
      address: "100 Feet Road, Indiranagar, Bengaluru 560038", amenities: JSON.stringify(["True Stadium Rake", "Dolby Atmos", "Sofa Lounge Hall", "Gourmet Kitchen", "Valet Parking"]),
      status: "APPROVED",
    },
  });
  const galaxy = await db.theatre.create({
    data: {
      ownerId: ownerLumiere.id, name: "Galaxy Multiplex — Koramangala", city: "Bengaluru",
      address: "80 Feet Road, Koramangala 4th Block, Bengaluru 560034", amenities: JSON.stringify(["4K Laser Projection", "Dolby 7.1", "Gaming Lounge", "Cafe", "Parking"]),
      status: "APPROVED",
    },
  });
  const nizam = await db.theatre.create({
    data: {
      ownerId: ownerMeridian.id, name: "Nizam Grand — Banjara Hills", city: "Hyderabad",
      address: "Road No. 12, Banjara Hills, Hyderabad 500034", amenities: JSON.stringify(["XL Premium Screen", "Dolby Atmos", "Fine Dining", "Valet Parking"]),
      status: "APPROVED",
    },
  });
  const marquee = await db.theatre.create({
    data: {
      ownerId: ownerMeridian.id, name: "Marine Marquee — Dadar", city: "Mumbai",
      address: "Ranade Road, Dadar West, Mumbai 400028", amenities: JSON.stringify(["Heritage Marquee Hall", "22 m Screen", "Balcony Tier", "Classic Concessions"]),
      status: "APPROVED",
    },
  });
  const tamilScreens = await db.theatre.create({
    data: {
      ownerId: ownerFrost.id, name: "Tamil Screens — Simmakkal", city: "Madurai",
      address: "Simmakkal North Street, Madurai 625001", amenities: JSON.stringify(["Neighbourhood Single Screen", "Digital 4K", "Snack Counter", "Parking"]),
      status: "APPROVED",
    },
  });
  // ---- 2026-11 second expansion: Delhi, Kolkata, Pune, Kochi, Jaipur ----
  const imperial = await db.theatre.create({
    data: {
      ownerId: ownerCapital.id, name: "Imperial Cines — Connaught Place", city: "Delhi",
      address: "Connaught Place, New Delhi 110001", amenities: JSON.stringify(["Twin Flagship Halls", "Dolby Atmos", "IMAX-style Screen", "Bistro Bar", "Valet Parking"]),
      status: "APPROVED",
    },
  });
  const yamuna = await db.theatre.create({
    data: {
      ownerId: ownerCapital.id, name: "Yamuna Prime — Dwarka", city: "Delhi",
      address: "Dwarka Sector 21, New Delhi 110075", amenities: JSON.stringify(["Recliner-First Hall", "Dolby 7.1", "Lounge Bar", "Free Parking"]),
      status: "APPROVED",
    },
  });
  const bengalGrand = await db.theatre.create({
    data: {
      ownerId: ownerEastern.id, name: "Bengal Grand — Esplanade", city: "Kolkata",
      address: "Esplanade, Kolkata 700016", amenities: JSON.stringify(["Heritage Balcony Hall", "Dolby Digital", "Classic Snacks", "Parking"]),
      status: "APPROVED",
    },
  });
  const deccan = await db.theatre.create({
    data: {
      ownerId: ownerEastern.id, name: "Deccan Reels — FC Road", city: "Pune",
      address: "FC Road, Shivajinagar, Pune 411005", amenities: JSON.stringify(["Student Favourite", "Digital 4K", "Cafe", "Late-night Shows"]),
      status: "APPROVED",
    },
  });
  const backwater = await db.theatre.create({
    data: {
      ownerId: ownerEastern.id, name: "Backwater Screens — Marine Drive", city: "Kochi",
      address: "Marine Drive, Ernakulam, Kochi 682031", amenities: JSON.stringify(["Backwater-view Lobby", "Dolby Atmos", "Family Combos", "Parking"]),
      status: "APPROVED",
    },
  });
  const rajmahal = await db.theatre.create({
    data: {
      ownerId: ownerCapital.id, name: "Rajmahal Cinema — MI Road", city: "Jaipur",
      address: "MI Road, Jaipur 302001", amenities: JSON.stringify(["Palace-style Auditorium", "19 m Screen", "Dolby Atmos", "Rooftop Cafe", "Valet Parking"]),
      status: "APPROVED",
    },
  });
  await db.theatreStaff.create({ data: { theatreId: frost.id, userId: staff.id } });
  await db.theatreStaff.create({ data: { theatreId: tamilScreens.id, userId: staff.id } });
  await db.theatreStaff.create({ data: { theatreId: yamuna.id, userId: staff.id } });
  console.log("✓ 15 theatres across 12 cities (Flame Multiplex intentionally left PENDING for admin approval demo)");

  // ---- Auditoriums — every hall has its OWN layout, screen size and interior theme ----
  const frostA1 = await createAuditorium(frost.id, "Audi 1 · Grand", DEMO_LAYOUTS.grand);
  const frostA2 = await createAuditorium(frost.id, "Audi 2 · Classic", DEMO_LAYOUTS.classic);
  const flameA1 = await createAuditorium(flame.id, "Audi 1 · Luxe", DEMO_LAYOUTS.luxe, { SILVER: 220, GOLD: 320, RECLINER: 520 });
  const pearlA1 = await createAuditorium(pearl.id, "Audi 1 · Retro Single Screen", DEMO_LAYOUTS.retro, { SILVER: 120, GOLD: 190, RECLINER: 280 });
  const pearlA2 = await createAuditorium(pearl.id, "Audi 2 · Family", DEMO_LAYOUTS.family, { SILVER: 140, GOLD: 200, RECLINER: 300 });
  const auroraA1 = await createAuditorium(aurora.id, "Audi 1 · IMAX Experience", DEMO_LAYOUTS.imax, { SILVER: 240, GOLD: 340, RECLINER: 480 });
  const auroraA2 = await createAuditorium(aurora.id, "Audi 2 · Atrium Fan", DEMO_LAYOUTS.fan, { SILVER: 160, GOLD: 240, RECLINER: 380 });
  const auroraA3 = await createAuditorium(aurora.id, "Audi 3 · Boutique Lounge", DEMO_LAYOUTS.boutique, { RECLINER: 650 });
  const lumiereA1 = await createAuditorium(lumiere.id, "Audi 1 · Stadium", DEMO_LAYOUTS.stadium);
  const lumiereA2 = await createAuditorium(lumiere.id, "Audi 2 · Sofa Lounge", DEMO_LAYOUTS.lounge);
  const galaxyA1 = await createAuditorium(galaxy.id, "Audi 1 · Galaxy", DEMO_LAYOUTS.galaxy);
  const nizamA1 = await createAuditorium(nizam.id, "Audi 1 · XL Premiere", DEMO_LAYOUTS.premiere);
  const marqueeA1 = await createAuditorium(marquee.id, "Audi 1 · Heritage Marquee", DEMO_LAYOUTS.marquee, { SILVER: 150, GOLD: 220, RECLINER: 320 });
  const tamilA1 = await createAuditorium(tamilScreens.id, "Audi 1 · Neighbourhood", DEMO_LAYOUTS.cube, { SILVER: 130, GOLD: 180, RECLINER: 260 });
  const imperialA1 = await createAuditorium(imperial.id, "Audi 1 · Spectrum", DEMO_LAYOUTS.spectrum);
  const imperialA2 = await createAuditorium(imperial.id, "Audi 2 · Diamond", DEMO_LAYOUTS.diamond);
  const yamunaA1 = await createAuditorium(yamuna.id, "Audi 1 · Opus", DEMO_LAYOUTS.opus);
  const bengalA1 = await createAuditorium(bengalGrand.id, "Audi 1 · Heritage Balcony", DEMO_LAYOUTS.heritage, { SILVER: 140, GOLD: 200, RECLINER: 290 });
  const deccanA1 = await createAuditorium(deccan.id, "Audi 1 · Velocity", DEMO_LAYOUTS.velocity, { SILVER: 120, GOLD: 170, RECLINER: 250 });
  const backwaterA1 = await createAuditorium(backwater.id, "Audi 1 · Lagoon", DEMO_LAYOUTS.lagoon, { SILVER: 135, GOLD: 185, RECLINER: 270 });
  const rajmahalA1 = await createAuditorium(rajmahal.id, "Audi 1 · Palace", DEMO_LAYOUTS.palace, { SILVER: 145, GOLD: 210, RECLINER: 310 });
  console.log(
    `✓ 21 auditoriums + seats (grand ${frostA1.seatCount}, classic ${frostA2.seatCount}, luxe ${flameA1.seatCount}, retro ${pearlA1.seatCount}, family ${pearlA2.seatCount}, imax ${auroraA1.seatCount}, fan ${auroraA2.seatCount}, boutique ${auroraA3.seatCount}, stadium ${lumiereA1.seatCount}, lounge ${lumiereA2.seatCount}, galaxy ${galaxyA1.seatCount}, premiere ${nizamA1.seatCount}, marquee ${marqueeA1.seatCount}, cube ${tamilA1.seatCount}, spectrum ${imperialA1.seatCount}, diamond ${imperialA2.seatCount}, opus ${yamunaA1.seatCount}, heritage ${bengalA1.seatCount}, velocity ${deccanA1.seatCount}, lagoon ${backwaterA1.seatCount}, palace ${rajmahalA1.seatCount})`
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

  // Every auditorium gets 4 showtimes today — 84 shows with full seat inventory.
  const plan: { movieIdx: number; aud: string; language: string; format: string }[] = [
    // Frost Cinemas — City Centre (grand 206 · emerald, classic 140 · teal)
    { movieIdx: 0, aud: frostA1.id, language: "English", format: "IMAX 2D" },  // Interstellar
    { movieIdx: 1, aud: frostA1.id, language: "English", format: "3D" },        // Inception
    { movieIdx: 38, aud: frostA1.id, language: "Tamil", format: "IMAX 2D" },   // Jailer 2
    { movieIdx: 39, aud: frostA1.id, language: "Tamil", format: "2D" },        // Karuppu
    { movieIdx: 4, aud: frostA2.id, language: "Tamil", format: "2D" },          // Leo
    { movieIdx: 36, aud: frostA2.id, language: "Tamil", format: "2D" },       // Scene
    { movieIdx: 9, aud: frostA2.id, language: "Tamil", format: "2D" },          // Vikram
    { movieIdx: 45, aud: frostA2.id, language: "Tamil", format: "2D" },       // Sardar 2
    // Pearl Screens — T. Nagar (retro 320 · crimson, family 140 · copper)
    { movieIdx: 8, aud: pearlA1.id, language: "Telugu", format: "2D" },         // RRR
    { movieIdx: 10, aud: pearlA1.id, language: "Hindi", format: "2D" },         // 3 Idiots
    { movieIdx: 37, aud: pearlA1.id, language: "Tamil", format: "2D" },       // Mookuthi Amman 2
    { movieIdx: 41, aud: pearlA1.id, language: "Tamil", format: "2D" },       // Mandaadi
    { movieIdx: 15, aud: pearlA2.id, language: "English", format: "3D" },       // Kung Fu Panda 4
    { movieIdx: 6, aud: pearlA2.id, language: "Malayalam", format: "2D" },      // Premalu
    { movieIdx: 13, aud: pearlA2.id, language: "Tamil", format: "2D" },         // 96
    { movieIdx: 42, aud: pearlA2.id, language: "Tamil", format: "2D" },       // Thaai Kizhavi
    // Aurora Cineplex — VR Chennai (imax 216 · azure, fan 144 · rose, boutique 48 · violet)
    { movieIdx: 38, aud: auroraA1.id, language: "Tamil", format: "IMAX 2D" }, // Jailer 2
    { movieIdx: 0, aud: auroraA1.id, language: "English", format: "IMAX 2D" },  // Interstellar
    { movieIdx: 2, aud: auroraA1.id, language: "English", format: "IMAX 2D" },  // Oppenheimer
    { movieIdx: 28, aud: auroraA1.id, language: "Hindi", format: "IMAX 2D" }, // Ramayana: Rise of a Legend
    { movieIdx: 5, aud: auroraA2.id, language: "Telugu", format: "3D" },        // Kalki 2898 AD
    { movieIdx: 39, aud: auroraA2.id, language: "Tamil", format: "2D" },      // Karuppu
    { movieIdx: 7, aud: auroraA2.id, language: "Kannada", format: "2D" },       // Kantara
    { movieIdx: 45, aud: auroraA2.id, language: "Tamil", format: "2D" },      // Sardar 2
    { movieIdx: 13, aud: auroraA3.id, language: "Tamil", format: "2D" },        // 96
    { movieIdx: 6, aud: auroraA3.id, language: "Malayalam", format: "2D" },     // Premalu
    { movieIdx: 34, aud: auroraA3.id, language: "Mandarin", format: "2D" },   // Raise the Red Lantern
    { movieIdx: 33, aud: auroraA3.id, language: "Korean", format: "2D" },     // Paradise Lost
    // Flame Multiplex — Brookefields (luxe 88 · amber) — theatre is PENDING, hidden from customers
    { movieIdx: 6, aud: flameA1.id, language: "Malayalam", format: "2D" },      // Premalu
    { movieIdx: 38, aud: flameA1.id, language: "Tamil", format: "2D" },       // Jailer 2
    { movieIdx: 7, aud: flameA1.id, language: "Kannada", format: "2D" },        // Kantara
    { movieIdx: 36, aud: flameA1.id, language: "Tamil", format: "2D" },       // Scene
    // Lumière Cinemas — Indiranagar, Bengaluru (stadium 240 · indigo, lounge 60 · orchid)
    { movieIdx: 0, aud: lumiereA1.id, language: "English", format: "IMAX 2D" },  // Interstellar
    { movieIdx: 1, aud: lumiereA1.id, language: "English", format: "3D" },       // Inception
    { movieIdx: 28, aud: lumiereA1.id, language: "Hindi", format: "IMAX 2D" }, // Ramayana: Rise of a Legend
    { movieIdx: 15, aud: lumiereA1.id, language: "English", format: "3D" },      // Kung Fu Panda 4
    { movieIdx: 7, aud: lumiereA2.id, language: "Kannada", format: "2D" },       // Kantara
    { movieIdx: 6, aud: lumiereA2.id, language: "Malayalam", format: "2D" },     // Premalu
    { movieIdx: 39, aud: lumiereA2.id, language: "Tamil", format: "2D" },     // Karuppu
    { movieIdx: 43, aud: lumiereA2.id, language: "Tamil", format: "2D" },     // Haiku
    // Galaxy Multiplex — Koramangala, Bengaluru (galaxy 162 · sage)
    { movieIdx: 37, aud: galaxyA1.id, language: "Tamil", format: "2D" },      // Mookuthi Amman 2
    { movieIdx: 44, aud: galaxyA1.id, language: "Tamil", format: "2D" },      // Dorothy
    { movieIdx: 5, aud: galaxyA1.id, language: "Telugu", format: "2D" },         // Kalki 2898 AD
    { movieIdx: 4, aud: galaxyA1.id, language: "Tamil", format: "2D" },          // Leo
    // Nizam Grand — Banjara Hills, Hyderabad (premiere 176 · saffron)
    { movieIdx: 8, aud: nizamA1.id, language: "Telugu", format: "IMAX 2D" },     // RRR
    { movieIdx: 5, aud: nizamA1.id, language: "Telugu", format: "3D" },          // Kalki 2898 AD
    { movieIdx: 28, aud: nizamA1.id, language: "Telugu", format: "2D" },      // Ramayana: Rise of a Legend
    { movieIdx: 32, aud: nizamA1.id, language: "Telugu", format: "2D" },      // Mirzapur: The Movie
    // Marine Marquee — Dadar, Mumbai (marquee 324 · onyx)
    { movieIdx: 10, aud: marqueeA1.id, language: "Hindi", format: "2D" },        // 3 Idiots
    { movieIdx: 12, aud: marqueeA1.id, language: "English", format: "2D" },      // The Dark Knight
    { movieIdx: 32, aud: marqueeA1.id, language: "Hindi", format: "2D" },     // Mirzapur: The Movie
    { movieIdx: 38, aud: marqueeA1.id, language: "Hindi", format: "2D" },     // Jailer 2
    // Tamil Screens — Simmakkal, Madurai (cube 108 · sandstone)
    { movieIdx: 4, aud: tamilA1.id, language: "Tamil", format: "2D" },           // Leo
    { movieIdx: 41, aud: tamilA1.id, language: "Tamil", format: "2D" },       // Mandaadi
    { movieIdx: 13, aud: tamilA1.id, language: "Tamil", format: "2D" },          // 96
    { movieIdx: 40, aud: tamilA1.id, language: "Tamil", format: "2D" },       // Vishwanath & Sons
    // Imperial Cines — Connaught Place, Delhi (spectrum 264 · garnet, diamond 192 · mint)
    { movieIdx: 16, aud: imperialA1.id, language: "Hindi", format: "IMAX 2D" },  // Pathaan
    { movieIdx: 38, aud: imperialA1.id, language: "Hindi", format: "2D" },    // Jailer 2
    { movieIdx: 18, aud: imperialA1.id, language: "Telugu", format: "2D" },      // Baahubali 2
    { movieIdx: 28, aud: imperialA1.id, language: "Hindi", format: "IMAX 2D" }, // Ramayana: Rise of a Legend
    { movieIdx: 23, aud: imperialA2.id, language: "Hindi", format: "2D" },       // Andhadhun
    { movieIdx: 24, aud: imperialA2.id, language: "Hindi", format: "2D" },       // Drishyam 2
    { movieIdx: 31, aud: imperialA2.id, language: "Hindi", format: "2D" },    // Gajab Raat
    { movieIdx: 29, aud: imperialA2.id, language: "Hindi", format: "2D" },    // Nakhrewaalii
    // Yamuna Prime — Dwarka, Delhi (opus 198 · cocoa)
    { movieIdx: 28, aud: yamunaA1.id, language: "Hindi", format: "2D" },      // Ramayana: Rise of a Legend
    { movieIdx: 8, aud: yamunaA1.id, language: "Hindi", format: "2D" },          // RRR
    { movieIdx: 19, aud: yamunaA1.id, language: "Telugu", format: "2D" },        // Sita Ramam
    { movieIdx: 32, aud: yamunaA1.id, language: "Hindi", format: "2D" },      // Mirzapur: The Movie
    // Bengal Grand — Esplanade, Kolkata (heritage 284 · garnet)
    { movieIdx: 20, aud: bengalA1.id, language: "Tamil", format: "2D" },         // Ponniyin Selvan: Part I
    { movieIdx: 21, aud: bengalA1.id, language: "Tamil", format: "2D" },         // Jai Bhim
    { movieIdx: 34, aud: bengalA1.id, language: "Mandarin", format: "2D" },   // Raise the Red Lantern
    { movieIdx: 35, aud: bengalA1.id, language: "English", format: "2D" },    // Nurture
    // Deccan Reels — FC Road, Pune (velocity 160 · sky)
    { movieIdx: 22, aud: deccanA1.id, language: "Hindi", format: "2D" },         // Tumbbad
    { movieIdx: 31, aud: deccanA1.id, language: "Hindi", format: "2D" },      // Gajab Raat
    { movieIdx: 29, aud: deccanA1.id, language: "Hindi", format: "2D" },      // Nakhrewaalii
    { movieIdx: 15, aud: deccanA1.id, language: "English", format: "3D" },       // Kung Fu Panda 4
    // Backwater Screens — Marine Drive, Kochi (lagoon 124 · moss)
    { movieIdx: 6, aud: backwaterA1.id, language: "Malayalam", format: "2D" },   // Premalu
    { movieIdx: 44, aud: backwaterA1.id, language: "Tamil", format: "2D" },   // Dorothy
    { movieIdx: 19, aud: backwaterA1.id, language: "Tamil", format: "2D" },      // Sita Ramam
    { movieIdx: 37, aud: backwaterA1.id, language: "Tamil", format: "2D" },   // Mookuthi Amman 2
    // Rajmahal Cinema — MI Road, Jaipur (palace 240 · pearl)
    { movieIdx: 18, aud: rajmahalA1.id, language: "Hindi", format: "2D" },       // Baahubali 2
    { movieIdx: 28, aud: rajmahalA1.id, language: "Hindi", format: "2D" },    // Ramayana: Rise of a Legend
    { movieIdx: 30, aud: rajmahalA1.id, language: "Hindi", format: "2D" },    // Pyre
    { movieIdx: 8, aud: rajmahalA1.id, language: "Hindi", format: "2D" },        // RRR
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
  console.log("  owner@cine360.demo    → Theatre Owner (Frost Cinemas + Pearl Screens · Chennai, Tamil Screens · Madurai — APPROVED)");
  console.log("  owner2@cine360.demo   → Theatre Owner (Flame Multiplex · Coimbatore — PENDING approval)");
  console.log("  owner3@cine360.demo   → Theatre Owner (Aurora Cineplex · Chennai — APPROVED)");
  console.log("  owner4@cine360.demo   → Theatre Owner (Lumière Cinemas + Galaxy Multiplex · Bengaluru — APPROVED)");
  console.log("  owner5@cine360.demo   → Theatre Owner (Nizam Grand · Hyderabad + Marine Marquee · Mumbai — APPROVED)");
  console.log("  owner6@cine360.demo   → Theatre Owner (Imperial Cines + Yamuna Prime · Delhi, Rajmahal · Jaipur — APPROVED)");
  console.log("  owner7@cine360.demo   → Theatre Owner (Bengal Grand · Kolkata, Deccan Reels · Pune, Backwater Screens · Kochi — APPROVED)");
  console.log("  staff@cine360.demo    → Gate Staff (Frost Cinemas + Tamil Screens + Yamuna Prime) — ticket scanner");
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
