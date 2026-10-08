import { createServer } from "node:http";
import { Server } from "socket.io";
import { createRealtimeServer } from "./server.ts";

const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const authSecret = process.env.AUTH_SECRET;
const emitSecret = process.env.REALTIME_SECRET;
if (!authSecret || !emitSecret) {
  console.error("[realtime] AUTH_SECRET and REALTIME_SECRET are required");
  process.exit(1);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});
const realtime = createRealtimeServer(io, { authSecret, emitSecret });

httpServer.on("request", (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime(), sockets: io.engine.clientsCount }));
    return;
  }
  // Socket.io handles its own /socket.io/* path before this listener via its attach().
  if (req.url?.startsWith("/socket.io")) return;
  void realtime.handleHttp(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(404);
      res.end();
    }
  });
});

httpServer.listen(port, () => {
  console.log(`[realtime] listening on :${port}, origins: ${allowedOrigins.join(", ")}`);
});
