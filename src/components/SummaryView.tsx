"use client";

import { useState } from "react";
import type { ExtractionResult, SummaryLength, SummaryResult } from "@/lib/types";

interface SummaryViewProps {
  extraction: ExtractionResult;
  summary: SummaryResult;
  length: SummaryLength;
  fileName: string;
  isRegenerating: boolean;
  onLengthChange: (length: SummaryLength) => void;
  onStartOver: () => void;
}

const LENGTHS: { value: SummaryLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export function SummaryView({
  extraction,
  summary,
  length,
  fileName,
  isRegenerating,
  onLengthChange,
  onStartOver,
}: SummaryViewProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = formatForExport(summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, non-secure context).
      // Fail quietly rather than showing a scary error for a non-critical action.
    }
  }

  function handleDownload() {
    const text = formatForExport(summary);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(fileName)}-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl border border-line bg-paper-raised px-8 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-ink-muted">{fileName}</p>
            <h2 className="mt-1 font-display text-2xl text-ink">Summary</h2>
          </div>
          <div
            role="group"
            aria-label="Summary length"
            className="flex rounded-full border border-line bg-paper p-1"
          >
            {LENGTHS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onLengthChange(opt.value)}
                aria-pressed={length === opt.value}
                disabled={isRegenerating}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed
                  ${
                    length === opt.value
                      ? "bg-ink text-paper"
                      : "text-ink-muted hover:text-ink"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="mt-6">
          {isRegenerating ? (
            <p className="font-mono text-sm text-accent">Generating {length} summary...</p>
          ) : (
            <>
              <p className="whitespace-pre-line leading-relaxed text-ink">{summary.summary}</p>

              {summary.keyPoints.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-display text-base text-ink">Key points</h3>
                  <ul className="mt-3 space-y-2">
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-ink">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <dl className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 font-mono text-xs text-ink-muted">
          <div className="flex gap-1.5">
            <dt>source:</dt>
            <dd>{extraction.method === "ocr" ? "OCR" : "text layer"}</dd>
          </div>
          {extraction.pageCount ? (
            <div className="flex gap-1.5">
              <dt>pages:</dt>
              <dd>{extraction.pageCount}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt>words extracted:</dt>
            <dd>{extraction.wordCount.toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCopy}
          className="rounded-full border border-line bg-paper-raised px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper"
        >
          {copied ? "Copied" : "Copy summary"}
        </button>
        <button
          onClick={handleDownload}
          className="rounded-full border border-line bg-paper-raised px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper"
        >
          Download .txt
        </button>
        <button
          onClick={onStartOver}
          className="ml-auto rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90"
        >
          Summarize another document
        </button>
      </div>
    </div>
  );
}

function formatForExport(summary: SummaryResult): string {
  const points = summary.keyPoints.map((p) => `- ${p}`).join("\n");
  return points
    ? `${summary.summary}\n\nKey points:\n${points}`
    : summary.summary;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || "document";
}
