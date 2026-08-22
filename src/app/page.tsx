"use client";

import { useCallback, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingStatus, ProcessingStage } from "@/components/ProcessingStatus";
import { SummaryView } from "@/components/SummaryView";
import { ErrorState } from "@/components/ErrorState";
import type { ApiErrorBody, ExtractionResult, SummaryLength, SummaryResult } from "@/lib/types";

type AppState =
  | { kind: "idle" }
  | { kind: "processing"; stage: ProcessingStage; file: File; extraction?: ExtractionResult }
  | {
      kind: "summary";
      file: File;
      extraction: ExtractionResult;
      summary: SummaryResult;
      length: SummaryLength;
      isRegenerating: boolean;
    }
  | { kind: "error"; message: string; file?: File; extraction?: ExtractionResult };

const DEFAULT_LENGTH: SummaryLength = "medium";

export default function Home() {
  const [state, setState] = useState<AppState>({ kind: "idle" });

  const runExtraction = useCallback(async (file: File): Promise<ExtractionResult | null> => {
    setState({ kind: "processing", stage: "uploading", file });

    const formData = new FormData();
    formData.append("file", file);

    setState({ kind: "processing", stage: "extracting", file });

    let res: Response;
    try {
      res = await fetch("/api/extract", { method: "POST", body: formData });
    } catch {
      setState({
        kind: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
        file,
      });
      return null;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      setState({
        kind: "error",
        message: body?.error ?? "We couldn't process this document.",
        file,
      });
      return null;
    }

    return (await res.json()) as ExtractionResult;
  }, []);

  const runSummarization = useCallback(
    async (
      file: File,
      extraction: ExtractionResult,
      length: SummaryLength
    ): Promise<SummaryResult | null> => {
      let res: Response;
      try {
        res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extraction.text, length }),
        });
      } catch {
        setState({
          kind: "error",
          message: "Couldn't reach the server. Check your connection and try again.",
          file,
          extraction,
        });
        return null;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
        setState({
          kind: "error",
          message: body?.error ?? "We couldn't generate a summary for this document.",
          file,
          extraction,
        });
        return null;
      }

      return (await res.json()) as SummaryResult;
    },
    []
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      const extraction = await runExtraction(file);
      if (!extraction) return;

      setState({ kind: "processing", stage: "summarizing", file, extraction });
      const summary = await runSummarization(file, extraction, DEFAULT_LENGTH);
      if (!summary) return;

      setState({
        kind: "summary",
        file,
        extraction,
        summary,
        length: DEFAULT_LENGTH,
        isRegenerating: false,
      });
    },
    [runExtraction, runSummarization]
  );

  const handleLengthChange = useCallback(
    async (length: SummaryLength) => {
      if (state.kind !== "summary" || length === state.length) return;
      const { file, extraction, summary } = state;
      setState({ ...state, isRegenerating: true, length });

      const next = await runSummarization(file, extraction, length);
      if (!next) return;

      setState({ kind: "summary", file, extraction, summary: next, length, isRegenerating: false });
      void summary; // previous summary intentionally discarded once regeneration succeeds
    },
    [state, runSummarization]
  );

  const handleRetry = useCallback(() => {
    if (state.kind !== "error" || !state.file) return;
    if (state.extraction) {
      setState({ kind: "processing", stage: "summarizing", file: state.file, extraction: state.extraction });
      runSummarization(state.file, state.extraction, DEFAULT_LENGTH).then((summary) => {
        if (summary && state.file && state.extraction) {
          setState({
            kind: "summary",
            file: state.file,
            extraction: state.extraction,
            summary,
            length: DEFAULT_LENGTH,
            isRegenerating: false,
          });
        }
      });
    } else {
      handleFileSelected(state.file);
    }
  }, [state, runSummarization, handleFileSelected]);

  const handleStartOver = useCallback(() => setState({ kind: "idle" }), []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            Document Summary Assistant
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
            Upload a document.
            <br />
            Get a summary that actually reads it.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-muted">
            PDFs and scanned images, extracted faithfully and summarized without inventing
            anything that isn&apos;t on the page.
          </p>
        </header>

        <main>
          {state.kind === "idle" && <UploadZone onFileSelected={handleFileSelected} />}

          {state.kind === "processing" && (
            <ProcessingStatus
              stage={state.stage}
              fileName={state.file.name}
              fileType={state.file.type}
              fileSize={state.file.size}
              usingOcr={state.file.type.startsWith("image/")}
            />
          )}

          {state.kind === "summary" && (
            <SummaryView
              extraction={state.extraction}
              summary={state.summary}
              length={state.length}
              fileName={state.file.name}
              isRegenerating={state.isRegenerating}
              onLengthChange={handleLengthChange}
              onStartOver={handleStartOver}
            />
          )}

          {state.kind === "error" && (
            <ErrorState
              message={state.message}
              onRetry={state.file ? handleRetry : undefined}
              onStartOver={handleStartOver}
            />
          )}
        </main>
      </div>
    </div>
  );
}
