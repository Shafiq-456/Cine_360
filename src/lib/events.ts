// Realtime seat inventory events via the socket.io hub (mini-services/realtime-hub).
// Fire-and-forget: if the hub is down, clients fall back to interval polling.
const HUB_URL = process.env.REALTIME_HUB_URL || "http://127.0.0.1:3004";

export async function emitShowInventoryChanged(showId: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    await fetch(`${HUB_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: `show:${showId}`, event: "seats:changed", data: { showId } }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // hub unavailable — polling fallback keeps clients fresh
  }
}
