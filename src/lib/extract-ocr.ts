import { createWorker } from "tesseract.js";
import path from "node:path";

export interface OcrExtractionRaw {
  text: string;
  confidence: number;
}

// tesseract.js fetches trained-language data from a CDN by default, which is
// slow and an unnecessary runtime dependency on serverless (cold start +
// external network reliance for something the deployment already knows it
// needs). We bundle the English model in the repo and load it locally.
const TESSDATA_PATH = path.join(process.cwd(), "tessdata");

/**
 * Runs OCR on an image (or rasterized scanned page) buffer using Tesseract.
 * A fresh worker is created and terminated per call: this runs in a
 * serverless function, so there is no long-lived process to reuse a
 * worker pool across requests.
 */
export async function extractTextFromImage(buffer: Buffer): Promise<OcrExtractionRaw> {
  const worker = await createWorker("eng", 1, {
    langPath: TESSDATA_PATH,
    gzip: false,
    cachePath: TESSDATA_PATH,
  });
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(buffer);

    return {
      text: normalizeOcrText(text ?? ""),
      confidence: confidence ?? 0,
    };
  } finally {
    await worker.terminate();
  }
}

function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
