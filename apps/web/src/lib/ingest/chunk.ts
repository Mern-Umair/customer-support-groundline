/**
 * Recursive character splitting.
 *
 * Why: the 2026 chunking benchmarks (Firecrawl, Prem AI, Vectara) agree that recursive
 * splitting at ~512 tokens with 10–20% overlap is the best default for RAG over
 * documentation-style content. Semantic chunking costs more and scored worse on
 * end-to-end answers in those tests. We can revisit once the eval set exists.
 *
 * Token counts are approximated as chars / 4. Gemini's tokenizer differs slightly,
 * but we only need chunks to land in the right size band.
 */

export interface ChunkOptions {
  /** Target size per chunk in approximate tokens. */
  targetTokens?: number;
  /** Overlap between consecutive chunks in approximate tokens. */
  overlapTokens?: number;
  /** Chunks shorter than this (tokens) are merged into their neighbour. */
  minTokens?: number;
}

export interface TextChunk {
  index: number;
  text: string;
  approxTokens: number;
}

const DEFAULTS: Required<ChunkOptions> = { targetTokens: 512, overlapTokens: 64, minTokens: 40 };
const SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

export const approxTokens = (text: string): number => Math.ceil(text.length / 4);

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split `text` into pieces no longer than `maxChars`, preferring the earliest separator that works. */
function splitRecursive(text: string, maxChars: number, separators: string[]): string[] {
  if (text.length <= maxChars) return [text];
  const [sep, ...rest] = separators;
  if (sep === undefined) {
    // No separators left: hard split.
    const out: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars));
    return out;
  }
  const parts = text.split(sep);
  if (parts.length === 1) return splitRecursive(text, maxChars, rest);

  const out: string[] = [];
  let buffer = "";
  for (const part of parts) {
    const candidate = buffer ? buffer + sep + part : part;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }
    if (buffer) out.push(buffer);
    if (part.length > maxChars) {
      out.push(...splitRecursive(part, maxChars, rest));
      buffer = "";
    } else {
      buffer = part;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

export function chunkText(input: string, options: ChunkOptions = {}): TextChunk[] {
  const opts = { ...DEFAULTS, ...options };
  const text = normalizeWhitespace(input);
  if (!text) return [];

  const maxChars = opts.targetTokens * 4;
  const overlapChars = opts.overlapTokens * 4;
  const minChars = opts.minTokens * 4;

  const pieces = splitRecursive(text, maxChars, SEPARATORS).map((p) => p.trim()).filter(Boolean);

  // Merge tiny trailing pieces into the previous one so we do not embed fragments.
  const merged: string[] = [];
  for (const piece of pieces) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && piece.length < minChars && prev.length + piece.length + 1 <= maxChars * 1.2) {
      merged[merged.length - 1] = `${prev}\n${piece}`;
    } else {
      merged.push(piece);
    }
  }

  // Add overlap: prefix each chunk with the tail of the previous chunk.
  const chunks: TextChunk[] = merged.map((piece, i) => {
    let body = piece;
    if (i > 0 && overlapChars > 0) {
      const prev = merged[i - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlapChars));
      // Start the overlap at a word boundary.
      const firstSpace = tail.indexOf(" ");
      const cleanTail = firstSpace > 0 && firstSpace < tail.length - 1 ? tail.slice(firstSpace + 1) : tail;
      body = `${cleanTail} ${piece}`;
    }
    return { index: i, text: body, approxTokens: approxTokens(body) };
  });

  return chunks;
}
