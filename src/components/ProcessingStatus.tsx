import { DocumentGlyph } from "./DocumentGlyph";
import { formatFileSize } from "@/lib/validation";

export type ProcessingStage = "uploading" | "extracting" | "summarizing";

const STAGE_LABEL: Record<ProcessingStage, string> = {
  uploading: "Uploading document...",
  extracting: "Extracting text...",
  summarizing: "Generating summary...",
};

interface ProcessingStatusProps {
  stage: ProcessingStage;
  fileName: string;
  fileType: string;
  fileSize: number;
  usingOcr?: boolean;
}

export function ProcessingStatus({
  stage,
  fileName,
  fileType,
  fileSize,
  usingOcr,
}: ProcessingStatusProps) {
  return (
    <div
      className="w-full rounded-2xl border border-line bg-paper-raised px-8 py-10"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-5">
        <DocumentGlyph scanning className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg text-ink">{fileName}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">
            {formatFileType(fileType)} · {formatFileSize(fileSize)}
          </p>
          <p className="mt-3 font-mono text-sm text-accent">
            {stage === "extracting" && usingOcr ? "Running OCR..." : STAGE_LABEL[stage]}
          </p>
        </div>
      </div>
      <ol className="mt-8 flex items-center gap-2" aria-hidden="true">
        {(["uploading", "extracting", "summarizing"] as ProcessingStage[]).map((s, i, arr) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                stageIndex(stage) >= i ? "bg-accent" : "bg-line"
              }`}
            />
            {i < arr.length - 1 && <span className="sr-only">then</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function stageIndex(stage: ProcessingStage): number {
  return ["uploading", "extracting", "summarizing"].indexOf(stage);
}

function formatFileType(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase();
  return mime;
}
