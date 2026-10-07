import type { Server } from "socket.io";
import { REALTIME_EVENTS, roomForTenant } from "@groundline/shared";

/**
 * Wires Socket.io rooms. Week 1: connection + tenant room join only.
 * Handoff and live-reply events are added in week 3.
 */
export function createRealtimeServer(io: Server) {
  io.on("connection", (socket) => {
    const tenantId = socket.handshake.auth?.tenantId;
    if (typeof tenantId === "string" && tenantId.length > 0) {
      void socket.join(roomForTenant(tenantId));
    }

    socket.on("disconnect", () => {
      /* nothing yet */
    });
  });

  return {
    events: REALTIME_EVENTS,
  };
}
