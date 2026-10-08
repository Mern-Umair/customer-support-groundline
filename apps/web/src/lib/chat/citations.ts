import { REFUSAL_SENTENCE } from "./prompt";

export interface ParsedAnswer {
  /** Answer text with invalid citation markers removed. */
  text: string;
  /** 1-based source numbers actually cited, in order of first appearance. */
  cited: number[];
  /** True when the model produced the refusal sentence (or nothing usable). */
  refused: boolean;
}

/**
 * Validates citation markers against the number of sources that were in the prompt.
 * A prompt alone cannot guarantee real citations, so any [n] outside 1..sourceCount is
 * stripped and never shown as a citation.
 */
export function parseAnswer(raw: string, sourceCount: number): ParsedAnswer {
  const cited: number[] = [];
  const text = raw
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_m, inner: string) => {
      const nums = inner.split(",").map((s) => Number(s.trim()));
      const valid = nums.filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount);
      for (const n of valid) if (!cited.includes(n)) cited.push(n);
      return valid.length ? `[${valid.join(", ")}]` : "";
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const refused = text.length === 0 || isRefusal(text);
  return { text, cited: refused ? [] : cited, refused };
}

export function isRefusal(text: string): boolean {
  const norm = text.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const key = REFUSAL_SENTENCE.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return norm.startsWith(key) || /^i (do not|don t|dont) have (that|this|the) information/.test(norm);
}
