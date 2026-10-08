import { ObjectId } from "mongodb";
import { z } from "zod";
import type { ToolImplementation, ToolResult, ToolRunContext } from "./types";

/**
 * Built-in tools against a mock "store backend" kept in the database per workspace.
 * They exist to demonstrate the agent loop end to end (read-only call → immediate; side
 * effect → owner approval). A real deployment would point these at the customer's systems.
 */

export interface MockOrderDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  orderNumber: string;
  customerEmail: string;
  status: "processing" | "shipped" | "delivered" | "returned";
  items: string[];
  trackingUrl?: string;
  placedAt: Date;
}

export interface TicketDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  conversationId: ObjectId;
  subject: string;
  details: string;
  email?: string;
  status: "open" | "closed";
  createdAt: Date;
}

export interface AppointmentDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  conversationId: ObjectId;
  date: string;
  time: string;
  name: string;
  purpose: string;
  createdAt: Date;
}

const orders = (db: ToolRunContext["db"]) => db.collection<MockOrderDoc>("mock_orders");
const tickets = (db: ToolRunContext["db"]) => db.collection<TicketDoc>("tickets");
const appointments = (db: ToolRunContext["db"]) => db.collection<AppointmentDoc>("appointments");

/** Seeds three fictional orders so lookupOrder has something to find. Idempotent. */
export async function seedMockOrders(db: ToolRunContext["db"], workspaceId: ObjectId): Promise<number> {
  const existing = await orders(db).countDocuments({ workspaceId });
  if (existing > 0) return 0;
  const now = Date.now();
  const docs: MockOrderDoc[] = [
    { _id: new ObjectId(), workspaceId, orderNumber: "48213", customerEmail: "ana@example.com", status: "shipped", items: ["Oxford · Chestnut · EU 41"], trackingUrl: "https://tracking.example/48213", placedAt: new Date(now - 3 * 86400_000) },
    { _id: new ObjectId(), workspaceId, orderNumber: "48300", customerEmail: "luis@example.com", status: "processing", items: ["Boot · Tan · EU 44 (E)"], placedAt: new Date(now - 86400_000) },
    { _id: new ObjectId(), workspaceId, orderNumber: "47990", customerEmail: "ana@example.com", status: "delivered", items: ["Loafer · Black · EU 39", "Cedar shoe trees"], placedAt: new Date(now - 12 * 86400_000) },
  ];
  await orders(db).insertMany(docs);
  return docs.length;
}

const LookupArgs = z.object({ orderNumber: z.string().trim().min(3).max(20), email: z.string().trim().email().optional() });
const TicketArgs = z.object({ subject: z.string().trim().min(3).max(120), details: z.string().trim().min(3).max(2000), email: z.string().trim().email().optional() });
const AppointmentArgs = z.object({ date: z.string().trim().min(6).max(20), time: z.string().trim().min(3).max(10), name: z.string().trim().min(1).max(80), purpose: z.string().trim().min(3).max(200) });

export const lookupOrder: ToolImplementation = {
  name: "lookupOrder",
  description: "Look up the status of an order by its order number. Use when the visitor asks where their order is or about its status. Read-only.",
  parameters: {
    type: "object",
    properties: {
      orderNumber: { type: "string", description: "The order number, digits only, e.g. 48213" },
      email: { type: "string", description: "The email used for the order, if the visitor gave it" },
    },
    required: ["orderNumber"],
  },
  sideEffect: false,
  async run(ctx, raw): Promise<ToolResult> {
    const parsed = LookupArgs.safeParse(raw);
    if (!parsed.success) return { ok: false, data: { error: "orderNumber is required" }, summary: "Invalid order lookup" };
    const order = await orders(ctx.db).findOne({ workspaceId: ctx.workspaceId, orderNumber: parsed.data.orderNumber.replace(/\D/g, "") });
    if (!order) return { ok: false, data: { found: false, orderNumber: parsed.data.orderNumber }, summary: `Order ${parsed.data.orderNumber} not found` };
    // Minimal privacy guard: without the matching email, reveal status only, not items.
    const verified = parsed.data.email?.toLowerCase() === order.customerEmail.toLowerCase();
    return {
      ok: true,
      data: { found: true, orderNumber: order.orderNumber, status: order.status, placedAt: order.placedAt.toISOString().slice(0, 10), ...(verified ? { items: order.items, trackingUrl: order.trackingUrl } : { note: "Items and tracking link are shown only when the order email is provided" }) },
      summary: `Order ${order.orderNumber}: ${order.status}`,
    };
  },
};

export const createTicket: ToolImplementation = {
  name: "createTicket",
  description: "Create a support ticket for the team to follow up (complaints, faulty items, anything the documents cannot resolve). This creates a record, so it needs approval.",
  parameters: {
    type: "object",
    properties: {
      subject: { type: "string", description: "One-line summary of the issue" },
      details: { type: "string", description: "What the visitor reported, in their words" },
      email: { type: "string", description: "Visitor's email for follow-up, if given" },
    },
    required: ["subject", "details"],
  },
  sideEffect: true,
  async run(ctx, raw): Promise<ToolResult> {
    const parsed = TicketArgs.safeParse(raw);
    if (!parsed.success) return { ok: false, data: { error: "subject and details are required" }, summary: "Invalid ticket" };
    const doc: TicketDoc = { _id: new ObjectId(), workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, ...parsed.data, status: "open", createdAt: new Date() };
    await tickets(ctx.db).insertOne(doc);
    return { ok: true, data: { ticketId: doc._id.toHexString().slice(-6).toUpperCase(), subject: doc.subject }, summary: `Ticket ${doc._id.toHexString().slice(-6).toUpperCase()} created: ${doc.subject}` };
  },
};

export const bookAppointment: ToolImplementation = {
  name: "bookAppointment",
  description: "Book an appointment (fitting, repair drop-off, consultation) on a given date and time. This creates a booking, so it needs approval.",
  parameters: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD" },
      time: { type: "string", description: "Time in HH:MM, 24-hour" },
      name: { type: "string", description: "Visitor's name" },
      purpose: { type: "string", description: "What the appointment is for" },
    },
    required: ["date", "time", "name", "purpose"],
  },
  sideEffect: true,
  async run(ctx, raw): Promise<ToolResult> {
    const parsed = AppointmentArgs.safeParse(raw);
    if (!parsed.success) return { ok: false, data: { error: "date, time, name and purpose are required" }, summary: "Invalid appointment" };
    const doc: AppointmentDoc = { _id: new ObjectId(), workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, ...parsed.data, createdAt: new Date() };
    await appointments(ctx.db).insertOne(doc);
    return { ok: true, data: { confirmation: doc._id.toHexString().slice(-6).toUpperCase(), date: doc.date, time: doc.time }, summary: `Appointment booked for ${doc.name} on ${doc.date} at ${doc.time}` };
  },
};

export const ALL_TOOLS: ToolImplementation[] = [lookupOrder, createTicket, bookAppointment];
export type ToolName = "lookupOrder" | "createTicket" | "bookAppointment";

export function toolByName(name: string): ToolImplementation | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}
