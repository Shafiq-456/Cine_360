// CINE 360 realtime hub — socket.io relay for live seat inventory.
//
// Ports (sandbox single-gateway constraint):
//   :3003 → socket.io (browser clients connect via gateway: io('/?XTransformPort=3003'))
//   :3004 → plain HTTP API (server-to-server, localhost only): POST /emit, GET /health
// Next.js API routes POST seat-inventory changes to :3004; clients in the
// `show:{id}` room receive "seats:changed" and re-fetch live inventory.
// Start: bun run dev (auto-restarts with --hot).
import { createServer } from "http";
import { Server } from "socket.io";

const SOCKET_PORT = Number(process.env.HUB_SOCKET_PORT || 3003);
const HTTP_PORT = Number(process.env.HUB_HTTP_PORT || 3004);

function roomSize(showId: string) {
  return io.sockets.adapter.rooms.get(`show:${showId}`)?.size || 0;
}

// ---- socket.io side (browser) ----
const io = new Server(SOCKET_PORT, {
  // path must stay "/" — matches the sandbox gateway forwarding contract
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  socket.on("join-show", (showId: string) => {
    if (typeof showId === "string" && showId.length < 64) socket.join(`show:${showId}`);
  });
  socket.on("leave-show", (showId: string) => {
    if (typeof showId === "string") socket.leave(`show:${showId}`);
  });
});

// ---- HTTP side (Next.js server → hub) ----
const httpServer = createServer((req, res) => {
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { room, event, data } = JSON.parse(body);
        if (typeof room === "string" && typeof event === "string" && room.length < 128 && event.length < 64) {
          io.to(room).emit(event, data || {});
          json(200, { ok: true });
        } else {
          json(400, { ok: false, error: "room and event (short strings) required" });
        }
      } catch {
        json(400, { ok: false, error: "invalid JSON" });
      }
    });
    return;
  }
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    json(200, { ok: true, service: "cine360-realtime-hub", sockets: io.sockets.sockets.size });
    return;
  }
  json(404, { ok: false, error: "not found" });
});

httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(`[realtime-hub] socket.io :${SOCKET_PORT} (path /) · http :${HTTP_PORT}`);
});
