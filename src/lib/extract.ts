import { extractPdfText, isTextLayerInsufficient } from "./extract-pdf";
import { extractTextFromImage } from "./extract-ocr";
import { rasterizePdfPages } from "./rasterize-pdf";
import { isValidPdfSignature, isValidImageSignature } from "./file-signature";
import type { ExtractionResult } from "./types";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Extracts text from an uploaded document buffer.
 *
 * PDFs: try the embedded text layer first. If it's empty/sparse (a scan),
 * fall back to rasterizing pages and running OCR on each one.
 * Images: OCR directly.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  if (mimeType === "application/pdf") {
    return extractFromPdf(buffer);
  }

  if (mimeType.startsWith("image/")) {
    return extractFromImage(buffer, mimeType);
  }

  throw new ExtractionError(
    `Unsupported mime type: ${mimeType}`,
    "This file type isn't supported. Please upload a PDF, PNG, JPG, or WEBP file."
  );
}

async function extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  if (!isValidPdfSignature(buffer)) {
    throw new ExtractionError(
      "File does not have a valid PDF signature",
      "This doesn't look like a valid PDF file. Please check the file and try again."
    );
  }

  let pdfResult;
  try {
    pdfResult = await extractPdfText(buffer);
  } catch (err) {
    throw new ExtractionError(
      `PDF parsing failed: ${err instanceof Error ? err.message : String(err)}`,
      "We couldn't read this PDF — it may be corrupted or password-protected. Please try a different file."
    );
  }

  if (!isTextLayerInsufficient(pdfResult.text)) {
    return toResult(pdfResult.text, "pdf-text", pdfResult.pageCount);
  }

  // No usable text layer — likely a scanned PDF. Fall back to OCR.
  let pages: Buffer[];
  try {
    pages = await rasterizePdfPages(buffer);
  } catch (err) {
    throw new ExtractionError(
      `PDF rasterization failed: ${err instanceof Error ? err.message : String(err)}`,
      "This PDF appears to be a scan, and we couldn't process it for OCR. Please try a different file or upload it as an image instead."
    );
  }

  if (pages.length === 0) {
    throw new ExtractionError(
      "No text layer and no pages to rasterize",
      "We couldn't find any readable text in this PDF."
    );
  }

  const ocrTexts: string[] = [];
  for (const pageBuffer of pages) {
    try {
      const { text } = await extractTextFromImage(pageBuffer);
      if (text.trim()) ocrTexts.push(text.trim());
    } catch {
      // Skip pages that fail OCR individually rather than failing the whole document.
    }
  }

  const combinedText = ocrTexts.join("\n\n");

  if (isTextLayerInsufficient(combinedText)) {
    throw new ExtractionError(
      "OCR fallback produced insufficient text",
      "We ran OCR on this scanned PDF but couldn't extract meaningful text. The scan quality may be too low."
    );
  }

  return toResult(combinedText, "ocr", pdfResult.pageCount);
}

async function extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  if (!isValidImageSignature(buffer, mimeType)) {
    throw new ExtractionError(
      "File does not have a valid image signature",
      "This file doesn't look like a valid image. Please check the file and try again."
    );
  }

  let ocrResult;
  try {
    ocrResult = await extractTextFromImage(buffer);
  } catch (err) {
    throw new ExtractionError(
      `OCR failed: ${err instanceof Error ? err.message : String(err)}`,
      "We couldn't run OCR on this image. Please try a clearer image or a different file."
    );
  }

  if (isTextLayerInsufficient(ocrResult.text)) {
    throw new ExtractionError(
      "OCR produced insufficient text",
      "We couldn't find readable text in this image. Try a clearer photo or scan."
    );
  }

  return toResult(ocrResult.text, "ocr");
}

function toResult(
  text: string,
  method: ExtractionResult["method"],
  pageCount?: number
): ExtractionResult {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    text,
    method,
    pageCount,
    charCount: text.length,
    wordCount,
  };
}
