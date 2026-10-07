import { extractText, getDocumentProxy } from "unpdf";
import { normalizeWhitespace } from "./chunk";

export interface ExtractedPdf {
  totalPages: number;
  /** One entry per page, whitespace-normalised. Empty strings for pages without text (scans). */
  pages: string[];
  text: string;
}

/**
 * PDF text extraction with unpdf (pdf.js without native deps), chosen because it runs on
 * Vercel's serverless runtime where pdf-parse's optional canvas dependency fails to build.
 * Scanned PDFs without a text layer yield empty pages; OCR is out of scope for v1.
 */
export async function extractPdf(data: Uint8Array | ArrayBuffer): Promise<ExtractedPdf> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  const pages = text.map((p) => normalizeWhitespace(p));
  return { totalPages, pages, text: pages.filter(Boolean).join("\n\n") };
}
