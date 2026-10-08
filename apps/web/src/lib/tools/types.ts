import type { ObjectId } from "mongodb";

/** JSON-schema subset accepted by both Gemini and OpenAI-style function calling. */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, { type: "string" | "number" | "integer" | "boolean"; description: string; enum?: string[] }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  /** Read-only tools run immediately; side-effecting tools wait for an owner's approval. */
  sideEffect: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolRunContext {
  db: import("mongodb").Db;
  workspaceId: ObjectId;
  conversationId: ObjectId;
}

export interface ToolResult {
  ok: boolean;
  /** Shown to the model (and, for approved side effects, summarised to the visitor). */
  data: Record<string, unknown>;
  /** Short human-readable summary for transcripts and notes. */
  summary: string;
}

export interface ToolImplementation extends ToolDefinition {
  run(ctx: ToolRunContext, args: Record<string, unknown>): Promise<ToolResult>;
}
