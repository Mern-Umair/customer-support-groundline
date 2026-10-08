import type { Db, ObjectId } from "mongodb";
import { conversations, messages } from "./db/collections";
import { scoped } from "./tenant";

export interface DailyCount {
  /** YYYY-MM-DD (UTC) */
  day: string;
  conversations: number;
  handoffs: number;
}

export interface UnansweredQuestion {
  messageId: string;
  conversationId: string;
  question: string;
  askedAt: string;
  channel: "playground" | "widget";
}

export interface Insights {
  rangeDays: number;
  conversations: number;
  answers: number;
  refusals: number;
  /** Share of answers that were not refusals, 0..1, or null without answers. */
  answeredRate: number | null;
  handoffs: number;
  avgLatencyMs: number | null;
  costUsd: number;
  tokens: number;
  feedback: { up: number; down: number; score: number | null };
  daily: DailyCount[];
  unanswered: UnansweredQuestion[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dashboard numbers for the last `rangeDays` days. All queries are tenant-scoped. */
export async function getInsights(db: Db, workspaceId: ObjectId, rangeDays = 30, now = new Date()): Promise<Insights> {
  const since = new Date(now.getTime() - rangeDays * 24 * 3600 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const [convoAgg, convoDaily, handoffDaily, msgAgg, feedbackAgg, unansweredDocs] = await Promise.all([
    conversations(db)
      .aggregate<{ count: number; answers: number; refusals: number; latency: number; cost: number; tokens: number; handoffs: number }>([
        { $match: scoped(workspaceId, { createdAt: { $gte: since } }) },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            answers: { $sum: "$totals.answers" },
            refusals: { $sum: "$totals.refusals" },
            latency: { $sum: "$totals.latencyMs" },
            cost: { $sum: "$totals.costUsd" },
            tokens: { $sum: { $add: ["$totals.inputTokens", "$totals.outputTokens"] } },
            handoffs: { $sum: { $cond: [{ $gte: ["$handoff.requestedAt", since] }, 1, 0] } },
          },
        },
      ])
      .next(),
    conversations(db)
      .aggregate<{ _id: string; n: number }>([
        { $match: scoped(workspaceId, { createdAt: { $gte: since } }) },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    conversations(db)
      .aggregate<{ _id: string; n: number }>([
        { $match: scoped(workspaceId, { "handoff.requestedAt": { $gte: since } }) },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$handoff.requestedAt" } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    messages(db)
      .aggregate<{ answers: number }>([{ $match: scoped(workspaceId, { role: "assistant", createdAt: { $gte: since } }) }, { $group: { _id: null, answers: { $sum: 1 } } }])
      .next(),
    messages(db)
      .aggregate<{ _id: "up" | "down"; n: number }>([
        { $match: scoped(workspaceId, { role: "assistant", "feedback.at": { $gte: since } }) },
        { $group: { _id: "$feedback.vote", n: { $sum: 1 } } },
      ])
      .toArray(),
    messages(db)
      .find(scoped(workspaceId, { role: "assistant", refused: true, createdAt: { $gte: since } }), { sort: { createdAt: -1 }, limit: 50, projection: { conversationId: 1, question: 1, createdAt: 1 } })
      .toArray(),
  ]);

  // Fill every day in range so the chart has a continuous axis.
  const byDay = new Map(convoDaily.map((d) => [d._id, d.n]));
  const handoffByDay = new Map(handoffDaily.map((d) => [d._id, d.n]));
  const daily: DailyCount[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const key = dayKey(d);
    daily.push({ day: key, conversations: byDay.get(key) ?? 0, handoffs: handoffByDay.get(key) ?? 0 });
  }

  const up = feedbackAgg.find((f) => f._id === "up")?.n ?? 0;
  const down = feedbackAgg.find((f) => f._id === "down")?.n ?? 0;

  // Resolve questions for refusals stored before `question` was recorded on the message.
  const channelByConvo = new Map<string, "playground" | "widget">();
  if (unansweredDocs.length) {
    const ids = [...new Set(unansweredDocs.map((m) => m.conversationId.toHexString()))];
    const convos = await conversations(db)
      .find(scoped(workspaceId, { _id: { $in: unansweredDocs.map((m) => m.conversationId) } }), { projection: { channel: 1 } })
      .toArray();
    for (const c of convos) channelByConvo.set(c._id.toHexString(), c.channel);
    void ids;
  }
  const unanswered: UnansweredQuestion[] = unansweredDocs
    .filter((m) => m.question)
    .slice(0, 20)
    .map((m) => ({
      messageId: m._id.toHexString(),
      conversationId: m.conversationId.toHexString(),
      question: m.question!,
      askedAt: m.createdAt.toISOString(),
      channel: channelByConvo.get(m.conversationId.toHexString()) ?? "widget",
    }));

  const answers = convoAgg?.answers ?? msgAgg?.answers ?? 0;
  const refusals = convoAgg?.refusals ?? 0;
  return {
    rangeDays,
    conversations: convoAgg?.count ?? 0,
    answers,
    refusals,
    answeredRate: answers > 0 ? (answers - refusals) / answers : null,
    handoffs: convoAgg?.handoffs ?? 0,
    avgLatencyMs: answers > 0 && convoAgg ? Math.round(convoAgg.latency / answers) : null,
    costUsd: convoAgg?.cost ?? 0,
    tokens: convoAgg?.tokens ?? 0,
    feedback: { up, down, score: up + down > 0 ? up / (up + down) : null },
    daily,
    unanswered,
  };
}
