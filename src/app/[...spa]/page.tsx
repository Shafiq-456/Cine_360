import { redirect } from "next/navigation";

// CINE 360 uses a hash-based SPA router (#/movies, #/book/showId, …) so the
// whole product lives under "/" in the sandbox preview. This catch-all sends
// plain deep links (e.g. /movies, /book/xyz) into the hash shell, so direct
// entry and refreshes never hit the framework 404.
export default async function SpaRedirect({ params }: { params: Promise<{ spa: string[] }> }) {
  const { spa } = await params;
  redirect(`/#/${spa.map((s) => encodeURIComponent(s)).join("/")}`);
}
