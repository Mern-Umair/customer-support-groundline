import { z } from "zod";

export const PlanId = z.enum(["free", "pro"]);
export type PlanId = z.infer<typeof PlanId>;

export interface PlanLimits {
  /** Max knowledge sources (websites + uploads) per workspace. */
  maxSources: number;
  /** Max pages crawled per website source. */
  maxPagesPerSite: number;
  /** Max upload size per document in bytes. Vercel functions accept 4.5 MB bodies. */
  maxUploadBytes: number;
  /** Max chat messages per calendar month. */
  maxMessagesPerMonth: number;
  /** Max team members including the owner. */
  maxSeats: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { maxSources: 5, maxPagesPerSite: 50, maxUploadBytes: 4 * 1024 * 1024, maxMessagesPerMonth: 200, maxSeats: 2 },
  pro: { maxSources: 50, maxPagesPerSite: 500, maxUploadBytes: 4 * 1024 * 1024, maxMessagesPerMonth: 5000, maxSeats: 10 },
};

export const PLAN_PRICES_USD: Record<PlanId, number> = { free: 0, pro: 29 };
