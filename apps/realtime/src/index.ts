import { createServer } from "node:http";
import { Server } from "socket.io";
import { createRealtimeServer } from "./server.ts";

const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

createRealtimeServer(io);

httpServer.listen(port, () => {
  console.log(`[realtime] listening on :${port}, origins: ${allowedOrigins.join(", ")}`);
});
