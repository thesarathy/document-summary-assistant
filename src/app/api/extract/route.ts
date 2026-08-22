import { NextRequest, NextResponse } from "next/server";
import { extractDocumentText, ExtractionError } from "@/lib/extract";
import { validateFile } from "@/lib/validation";
import type { ApiErrorBody, ExtractionResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("We couldn't read your upload. Please try again.", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return errorResponse("No file was uploaded.", 400);
  }

  const validation = validateFile(file.type, file.size);
  if (!validation.valid) {
    return errorResponse(validation.error!, 400);
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch {
    return errorResponse("We couldn't read this file. It may be corrupted.", 400);
  }

  try {
    const result: ExtractionResult = await extractDocumentText(buffer, file.type);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ExtractionError) {
      console.error("Extraction failed:", err.message);
      return errorResponse(err.userMessage, 422, err.message);
    }
    console.error("Unexpected extraction error:", err);
    return errorResponse(
      "Something went wrong while processing your document. Please try again.",
      500
    );
  }
}

function errorResponse(error: string, status: number, detail?: string) {
  const body: ApiErrorBody = { error, detail };
  return NextResponse.json(body, { status });
}
