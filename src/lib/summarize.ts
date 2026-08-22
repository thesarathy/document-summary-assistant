import Groq from "groq-sdk";
import { MAX_CHARS_FOR_SINGLE_PASS } from "./types";
import type { SummaryLength, SummaryResult } from "./types";

export class SummarizationError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = "SummarizationError";
  }
}

// llama-3.3-70b-versatile was shut down by Groq on 08/16/26. Using their
// recommended replacement for it (see https://console.groq.com/docs/deprecations).
const MODEL = "openai/gpt-oss-120b";

// Rough character budget per chunk when a document needs to be split before
// summarizing. Kept comfortably under the model's context window since each
// chunk also needs room for the prompt instructions and the response.
const CHUNK_CHAR_SIZE = 12000;

const LENGTH_SPEC: Record<SummaryLength, string> = {
  short:
    "SHORT: 2-4 sentences. Only the single most important takeaway and any critical numbers or conclusions. Omit supporting detail.",
  medium:
    "MEDIUM: 2-3 short paragraphs. Cover the major ideas, arguments, findings, and conclusions, but omit minor supporting detail.",
  long: "LONG: 4-6 paragraphs. Comprehensive but still a summary, not a rewrite — retain important supporting details, examples, and nuance while cutting redundancy.",
};

const KEY_POINTS_COUNT: Record<SummaryLength, string> = {
  short: "3-4",
  medium: "4-6",
  long: "6-8",
};

function buildSummaryPrompt(text: string, length: SummaryLength): string {
  return `You are a precise document summarization assistant. Summarize ONLY information that is explicitly supported by the document text below. Do not fabricate facts, figures, names, or conclusions that are not present in the text. If the document is ambiguous or incomplete, summarize what is actually there rather than inferring beyond it.

Requirements:
- Length and depth: ${LENGTH_SPEC[length]}
- Write in clear, plain language. No repetition of the same point.
- Extract ${KEY_POINTS_COUNT[length]} key points. Each must be a specific, substantive fact or finding from the document — never a generic statement like "the document discusses an important topic."
- Do not add commentary, opinions, or information from outside the document.

Respond with ONLY a JSON object in this exact shape, no markdown fences, no extra text:
{"summary": "...", "keyPoints": ["...", "..."]}

DOCUMENT TEXT:
"""
${text}
"""`;
}

function buildChunkSummaryPrompt(text: string): string {
  return `Summarize the following excerpt from a larger document in 3-5 sentences. Preserve specific facts, figures, and names exactly as written. Do not add information not present in the text. Respond with plain text only, no JSON, no preamble.

EXCERPT:
"""
${text}
"""`;
}

/**
 * Generates a length-controlled summary with key points from extracted
 * document text. Large documents are map-reduced: summarized in chunks,
 * then the chunk summaries are combined into a final pass, so we never
 * send an unbounded amount of text in one call.
 */
export async function generateSummary(
  text: string,
  length: SummaryLength
): Promise<SummaryResult> {
  const client = getClient();
  const sourceText = await condenseIfNeeded(client, text);
  return summarizeFinal(client, sourceText, length);
}

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new SummarizationError(
      "GROQ_API_KEY is not set",
      "Summarization isn't configured on the server. Please contact the site owner."
    );
  }
  return new Groq({ apiKey });
}

/** If the text is within budget, returns it unchanged. Otherwise map-reduces it down. */
async function condenseIfNeeded(client: Groq, text: string): Promise<string> {
  if (text.length <= MAX_CHARS_FOR_SINGLE_PASS) {
    return text;
  }

  const chunks = chunkText(text, CHUNK_CHAR_SIZE);
  const chunkSummaries: string[] = [];

  for (const chunk of chunks) {
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: buildChunkSummaryPrompt(chunk) }],
        temperature: 0.2,
        max_tokens: 400,
      });
      const content = completion.choices[0]?.message?.content?.trim();
      if (content) chunkSummaries.push(content);
    } catch (err) {
      throw wrapGroqError(err);
    }
  }

  if (chunkSummaries.length === 0) {
    throw new SummarizationError(
      "All chunk summarization calls failed",
      "We couldn't summarize this document. Please try again."
    );
  }

  return chunkSummaries.join("\n\n");
}

function chunkText(text: string, size: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > size && current) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

async function summarizeFinal(
  client: Groq,
  text: string,
  length: SummaryLength
): Promise<SummaryResult> {
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: buildSummaryPrompt(text, length) }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });
  } catch (err) {
    throw wrapGroqError(err);
  }

  const raw = completion.choices[0]?.message?.content ?? "";
  return parseSummaryResponse(raw);
}

/** Parses the model's JSON response, falling back gracefully if it's malformed. */
function parseSummaryResponse(raw: string): SummaryResult {
  const cleaned = raw
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
      : [];

    if (!summary) {
      throw new Error("Empty summary field");
    }

    return { summary, keyPoints };
  } catch {
    // Model didn't return valid JSON. Fall back to treating the raw text as
    // the summary rather than failing the whole request.
    if (cleaned.length > 0) {
      return { summary: cleaned, keyPoints: [] };
    }
    throw new SummarizationError(
      "Model returned empty or unparseable response",
      "We generated a response but couldn't format it correctly. Please try regenerating."
    );
  }
}

function wrapGroqError(err: unknown): SummarizationError {
  if (err instanceof Groq.APIError) {
    if (err.status === 429) {
      return new SummarizationError(
        `Groq rate limit: ${err.message}`,
        "The summarization service is busy right now. Please wait a moment and try again."
      );
    }
    return new SummarizationError(
      `Groq API error (${err.status}): ${err.message}`,
      "The summarization service is temporarily unavailable. Please try again shortly."
    );
  }
  return new SummarizationError(
    `Unexpected summarization error: ${err instanceof Error ? err.message : String(err)}`,
    "Something went wrong while generating the summary. Please try again."
  );
}
