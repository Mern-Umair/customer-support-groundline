import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server, Socket } from "socket.io";
import { EmitRequest, REALTIME_EVENTS, roomForConversation, roomForWorkspace, type RealtimeTokenPayload } from "@groundline/shared";
import { verifyRealtimeToken } from "./auth.ts";

export interface RealtimeConfig {
  /** Shared with the web app; signs socket tokens. */
  authSecret: string;
  /** Shared with the web app; authorises server-to-server /emit calls. */
  emitSecret: string;
}

type AuthedSocket = Socket & { data: { auth: RealtimeTokenPayload } };

/**
 * Rooms:
 *  - workspace:<id>                  every signed-in agent of the workspace (handoff alerts, status)
 *  - conversation:<ws>:<id>          the visitor of that conversation + agents who joined it
 *
 * Clients never emit messages to each other directly. All messages go through the web app
 * (which stores them) and arrive here via POST /emit, so the database is the source of truth.
 */
export function createRealtimeServer(io: Server, config: RealtimeConfig) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("missing token"));
    const auth = await verifyRealtimeToken(token, config.authSecret);
    if (!auth) return next(new Error("invalid token"));
    (socket as AuthedSocket).data.auth = auth;
    next();
  });

  io.on("connection", (raw) => {
    const socket = raw as AuthedSocket;
    const auth = socket.data.auth;

    if (auth.role === "agent") {
      void socket.join(roomForWorkspace(auth.workspaceId));
      socket.on(REALTIME_EVENTS.join, (conversationId: unknown) => {
        if (typeof conversationId === "string" && conversationId) void socket.join(roomForConversation(auth.workspaceId, conversationId));
      });
      socket.on(REALTIME_EVENTS.leave, (conversationId: unknown) => {
        if (typeof conversationId === "string" && conversationId) void socket.leave(roomForConversation(auth.workspaceId, conversationId));
      });
    } else {
      void socket.join(roomForConversation(auth.workspaceId, auth.conversationId));
    }
  });

  /** HTTP handler for the web app: POST /emit { room, event, payload } with Bearer emitSecret. */
  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.url !== "/emit" || req.method !== "POST") return false;
    const header = req.headers.authorization ?? "";
    if (header !== `Bearer ${config.emitSecret}`) {
      res.writeHead(401).end();
      return true;
    }
    const body = await readJson(req);
    const parsed = EmitRequest.safeParse(body);
    if (!parsed.success) {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid emit request" }));
      return true;
    }
    const { room, event, payload } = parsed.data;
    io.to(room).emit(event, payload);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
    return true;
  }

  return { handleHttp, events: REALTIME_EVENTS };
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (c: string) => {
      data += c;
      if (data.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
