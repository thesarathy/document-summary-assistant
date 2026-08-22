import { NextRequest, NextResponse } from "next/server";
import { generateSummary, SummarizationError } from "@/lib/summarize";
import type { ApiErrorBody, SummaryLength } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_LENGTHS: SummaryLength[] = ["short", "medium", "long"];

// Defensive cap on text sent directly to this endpoint (independent of the
// extraction endpoint's file-size limit) to bound worst-case LLM cost/latency
// if this route is called directly rather than through the normal flow.
const MAX_INPUT_CHARS = 200_000;

export async function POST(req: NextRequest) {
  let body: { text?: unknown; length?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  const { text, length } = body;

  if (typeof text !== "string" || text.trim().length === 0) {
    return errorResponse("No document text was provided.", 400);
  }

  if (text.length > MAX_INPUT_CHARS) {
    return errorResponse("This document is too large to summarize.", 400);
  }

  if (typeof length !== "string" || !VALID_LENGTHS.includes(length as SummaryLength)) {
    return errorResponse("Invalid summary length. Use 'short', 'medium', or 'long'.", 400);
  }

  try {
    const result = await generateSummary(text, length as SummaryLength);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SummarizationError) {
      console.error("Summarization failed:", err.message);
      return errorResponse(err.userMessage, 502, err.message);
    }
    console.error("Unexpected summarization error:", err);
    return errorResponse("Something went wrong while generating the summary. Please try again.", 500);
  }
}

function errorResponse(error: string, status: number, detail?: string) {
  const body: ApiErrorBody = { error, detail };
  return NextResponse.json(body, { status });
}
