import { z } from "zod";

export const PlanId = z.enum(["free", "pro"]);
export type PlanId = z.infer<typeof PlanId>;

export interface PlanLimits {
  /** Max pages crawled + documents uploaded per workspace. */
  maxSources: number;
  /** Max chat messages per calendar month. */
  maxMessagesPerMonth: number;
  /** Max team members including the owner. */
  maxSeats: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { maxSources: 50, maxMessagesPerMonth: 200, maxSeats: 1 },
  pro: { maxSources: 1000, maxMessagesPerMonth: 5000, maxSeats: 5 },
};
