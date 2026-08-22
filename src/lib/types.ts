export type SummaryLength = "short" | "medium" | "long";

export type ExtractionMethod = "pdf-text" | "ocr";

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
  pageCount?: number;
  charCount: number;
  wordCount: number;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

export interface ApiErrorBody {
  error: string;
  detail?: string;
}

/** File constraints enforced on both client and server. */
// Vercel serverless functions hard-cap request bodies at 4.5MB (infra-level,
// not configurable). We cap uploads well under that to leave headroom for
// multipart overhead, and because most real documents this size are already
// well past what's useful to summarize in one pass.
export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Minimum characters required before we trust the PDF text layer over OCR. */
export const MIN_VIABLE_TEXT_LENGTH = 50;

/** Rough character budget before we start chunking text for the LLM. */
export const MAX_CHARS_FOR_SINGLE_PASS = 18000;
