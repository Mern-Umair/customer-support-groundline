import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT } from "jose";
import { Server } from "socket.io";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { REALTIME_EVENTS, roomForConversation, roomForWorkspace, type RealtimeTokenPayload } from "@groundline/shared";
import { createRealtimeServer } from "./server.ts";

const AUTH_SECRET = "test-auth-secret-at-least-16";
const EMIT_SECRET = "test-emit-secret";

let httpServer: HttpServer;
let io: Server;
let url: string;

async function sign(payload: RealtimeTokenPayload, secret = AUTH_SECRET): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience("groundline-realtime").setExpirationTime("1h").sign(new TextEncoder().encode(secret));
}

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  const realtime = createRealtimeServer(io, { authSecret: AUTH_SECRET, emitSecret: EMIT_SECRET });
  httpServer.on("request", (req, res) => {
    if (req.url?.startsWith("/socket.io")) return;
    void realtime.handleHttp(req, res).then((h) => {
      if (!h) res.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

describe("realtime server", () => {
  it("rejects connections without a valid token", async () => {
    await expect(connectClient("nope")).rejects.toThrow(/invalid token/);
    await expect(connectClient(await sign({ role: "agent", workspaceId: "w", userId: "u", name: "A" }, "wrong-secret"))).rejects.toThrow(/invalid token/);
  });

  it("puts agents in their workspace room and visitors in their conversation room", async () => {
    const agent = await connectClient(await sign({ role: "agent", workspaceId: "w1", userId: "u1", name: "Sara" }));
    const visitor = await connectClient(await sign({ role: "visitor", workspaceId: "w1", conversationId: "c1" }));
    const inWorkspace = (await io.in(roomForWorkspace("w1")).fetchSockets()).map((s) => s.id);
    const inConversation = (await io.in(roomForConversation("w1", "c1")).fetchSockets()).map((s) => s.id);
    expect(inWorkspace).toEqual([agent.id]);
    expect(inConversation).toEqual([visitor.id]);
    agent.disconnect();
    visitor.disconnect();
  });

  it("lets an agent join conversations only inside their own workspace", async () => {
    const agent = await connectClient(await sign({ role: "agent", workspaceId: "w1", userId: "u1", name: "Sara" }));
    agent.emit(REALTIME_EVENTS.join, "c9");
    await new Promise((r) => setTimeout(r, 50));
    expect((await io.in(roomForConversation("w1", "c9")).fetchSockets()).map((s) => s.id)).toEqual([agent.id]);
    // The room name is derived from the token's workspace, so another workspace's room is unreachable.
    expect(await io.in(roomForConversation("w2", "c9")).fetchSockets()).toEqual([]);
    agent.disconnect();
  });

  it("/emit requires the secret and delivers to the room", async () => {
    const visitor = await connectClient(await sign({ role: "visitor", workspaceId: "w1", conversationId: "c2" }));
    const received = new Promise<unknown>((resolve) => visitor.on(REALTIME_EVENTS.message, resolve));

    const unauthorized = await fetch(`${url}/emit`, { method: "POST", body: "{}" });
    expect(unauthorized.status).toBe(401);

    const bad = await fetch(`${url}/emit`, { method: "POST", headers: { authorization: `Bearer ${EMIT_SECRET}` }, body: JSON.stringify({ room: "" }) });
    expect(bad.status).toBe(400);

    const ok = await fetch(`${url}/emit`, {
      method: "POST",
      headers: { authorization: `Bearer ${EMIT_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ room: roomForConversation("w1", "c2"), event: REALTIME_EVENTS.message, payload: { content: "hello from agent" } }),
    });
    expect(ok.status).toBe(200);
    expect(await received).toEqual({ content: "hello from agent" });
    visitor.disconnect();
  });
});
