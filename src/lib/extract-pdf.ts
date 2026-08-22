import { MIN_VIABLE_TEXT_LENGTH } from "./types";

export interface PdfExtractionRaw {
  text: string;
  pageCount: number;
}

/**
 * Extracts text from a PDF buffer using its embedded text layer.
 * Uses pdf-parse v2, which wraps a current pdfjs-dist build (unlike the
 * long-unmaintained v1 API, which fails on PDFs with modern compression).
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionRaw> {
  const { PDFParse } = await import("pdf-parse");
  // pdfjs-dist needs a real canvas backend in Node; without one it falls back
  // to broken browser-API polyfills ("Cannot polyfill Path2D/DOMMatrix") and
  // extraction fails on Vercel/serverless even though nothing looks wrong
  // locally. @napi-rs/canvas is pdf-parse's documented Node canvas backend.
  const { CanvasFactory } = await import("pdf-parse/worker");

  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const result = await parser.getText();
    return {
      text: normalizeExtractedText(result.text ?? ""),
      pageCount: result.pages?.length ?? 0,
    };
  } finally {
    // Best-effort cleanup only: a pinned pdfjs-dist version (see package.json
    // "overrides", pinned to patch a known PDF.js RCE advisory) is slightly
    // ahead of what this pdf-parse release's internal destroy() call expects,
    // so it can throw. That's harmless here — the process is short-lived
    // serverless — but we don't want a cleanup failure masking a real result.
    try {
      await parser.destroy();
    } catch {
      // no-op
    }
  }
}

/** True if the PDF's embedded text layer is too sparse to be useful (i.e. it's a scan). */
export function isTextLayerInsufficient(text: string): boolean {
  return text.trim().length < MIN_VIABLE_TEXT_LENGTH;
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^--\s*\d+\s*of\s*\d+\s*--$/gm, "") // pdf-parse's per-page separator markers
    .replace(/[ \t]+\n/g, "\n") // trailing spaces before line breaks
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .trim();
}
