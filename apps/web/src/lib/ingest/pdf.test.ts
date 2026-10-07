import { describe, expect, it } from "vitest";
import { extractPdf } from "./pdf";

/** Builds a minimal single-page PDF with one line of Helvetica text. Offsets computed at runtime. */
function tinyPdf(text: string): Uint8Array {
  const content = `BT /F1 18 Tf 40 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) body += `${String(o).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

describe("extractPdf", () => {
  it("extracts text per page from a real PDF", async () => {
    const result = await extractPdf(tinyPdf("Returns accepted within 14 days"));
    expect(result.totalPages).toBe(1);
    expect(result.pages[0]).toContain("Returns accepted within 14 days");
    expect(result.text).toContain("14 days");
  });

  it("rejects non-PDF bytes with an error instead of hanging", async () => {
    await expect(extractPdf(new TextEncoder().encode("this is not a pdf"))).rejects.toThrow();
  });
});
