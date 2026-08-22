import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./types";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Validates an uploaded file's type and size. Used on both client (fast feedback) and server (real enforcement). */
export function validateFile(mimeType: string, sizeBytes: number): ValidationResult {
  if (sizeBytes === 0) {
    return { valid: false, error: "This file appears to be empty." };
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    const maxMb = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `This file is too large. Please upload a file under ${maxMb}MB.` };
  }

  if (!ACCEPTED_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: "Unsupported file type. Please upload a PDF, PNG, JPG, or WEBP file.",
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
