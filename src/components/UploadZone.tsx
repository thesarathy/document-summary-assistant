"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_SIZE_BYTES } from "@/lib/types";
import { validateFile } from "@/lib/validation";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT_ATTR = [".pdf", ".png", ".jpg", ".jpeg", ".webp"].join(",");
const MAX_MB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);

export function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const result = validateFile(file.type, file.size);
      if (!result.valid) {
        setClientError(result.error ?? "This file can't be used.");
        return;
      }
      setClientError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Upload a PDF or image document. Drag and drop, or press Enter to browse files."
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors
          ${isDragging ? "border-accent bg-accent-soft" : "border-line bg-paper-raised hover:border-ink-muted"}
          ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-accent"
          >
            <path
              d="M12 16V4M12 4l-4 4M12 4l4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-display text-xl text-ink">
          Drop a document here, or{" "}
          <span className="text-accent underline underline-offset-4">browse</span>
        </p>
        <p className="mt-2 font-mono text-xs text-ink-muted">
          PDF · PNG · JPG · WEBP — up to {MAX_MB}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT_ATTR}
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {clientError && (
        <p role="alert" className="mt-3 text-sm text-error">
          {clientError}
        </p>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Documents are processed in memory for this session only and are not stored.
      </p>
    </div>
  );
}
