import type { EvalCaseDoc, EvalMetrics, EvalResultDoc, EvalRunDoc } from "../db/types";

export interface EvalCaseDto {
  id: string;
  kind: EvalCaseDoc["kind"];
  question: string;
  expectedAnswer?: string;
  expectedSource?: string;
  tags?: string[];
  createdAt: string;
}

export interface EvalResultDto extends Omit<EvalResultDoc, "caseId"> {
  caseId: string;
}

export interface EvalRunDto {
  id: string;
  status: EvalRunDoc["status"];
  config: EvalRunDoc["config"];
  total: number;
  done: number;
  metrics: EvalMetrics;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export const toCaseDto = (c: EvalCaseDoc): EvalCaseDto => ({
  id: c._id.toHexString(),
  kind: c.kind,
  question: c.question,
  expectedAnswer: c.expectedAnswer,
  expectedSource: c.expectedSource,
  tags: c.tags,
  createdAt: c.createdAt.toISOString(),
});

export const toRunDto = (r: EvalRunDoc): EvalRunDto => ({
  id: r._id.toHexString(),
  status: r.status,
  config: r.config,
  total: r.pending.length + r.results.length,
  done: r.results.length,
  metrics: r.metrics,
  startedAt: r.startedAt.toISOString(),
  finishedAt: r.finishedAt?.toISOString(),
  error: r.error,
});

export const toResultDto = (x: EvalResultDoc): EvalResultDto => ({ ...x, caseId: x.caseId.toHexString() });
