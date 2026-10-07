import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { roomForTenant } from "@groundline/shared";
import { createRealtimeServer } from "./server.ts";

let httpServer: HttpServer;
let io: Server;
let url: string;

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  createRealtimeServer(io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connectClient(auth: Record<string, unknown>): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { auth, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
  });
}

describe("realtime server", () => {
  it("joins the tenant room when the handshake carries a tenantId", async () => {
    const client = await connectClient({ tenantId: "t-acme" });
    const sockets = await io.in(roomForTenant("t-acme")).fetchSockets();
    expect(sockets.map((s) => s.id)).toContain(client.id);
    client.disconnect();
  });

  it("does not join any tenant room without a tenantId", async () => {
    const client = await connectClient({});
    const serverSocket = (await io.fetchSockets()).find((s) => s.id === client.id);
    expect(serverSocket).toBeDefined();
    const tenantRooms = [...(serverSocket?.rooms ?? [])].filter((r) => r.startsWith("tenant:"));
    expect(tenantRooms).toEqual([]);
    client.disconnect();
  });
});
