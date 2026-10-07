import type { ObjectId } from "mongodb";
import type { PlanId } from "@groundline/shared";

export interface UserDoc {
  _id: ObjectId;
  email: string; // lower-cased, unique
  name: string;
  passwordHash: string;
  createdAt: Date;
}

/** A workspace is the tenant. Every tenant-owned document carries `workspaceId`. */
export interface WorkspaceDoc {
  _id: ObjectId;
  name: string;
  slug: string; // unique, used in URLs
  publicKey: string; // unique, embedded in the widget script tag (safe to expose)
  plan: PlanId;
  createdBy: ObjectId;
  createdAt: Date;
}

export type MembershipRole = "owner" | "agent";

export interface MembershipDoc {
  _id: ObjectId;
  userId: ObjectId;
  workspaceId: ObjectId;
  role: MembershipRole;
  createdAt: Date;
}

/** Marker for documents that belong to a tenant. */
export interface TenantOwned {
  workspaceId: ObjectId;
}
