/**
 * Validates a file's actual bytes against known signatures, rather than
 * trusting the client-supplied MIME type (which can be wrong or spoofed).
 *
 * This matters specifically because a malformed image handed directly to
 * Tesseract's native image decoder can throw in a way that escapes normal
 * promise rejection handling and crashes the process (observed during
 * testing). Rejecting non-image bytes before they reach that code path
 * closes that failure mode entirely, rather than trying to catch an error
 * that isn't reliably catchable at the call site.
 */
export function isValidPdfSignature(buffer: Buffer): boolean {
  // PDFs start with "%PDF-"
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const isWebp =
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  if (mimeType === "image/png") return isPng;
  if (mimeType === "image/jpeg") return isJpeg;
  if (mimeType === "image/webp") return isWebp;

  // Fallback: accept any recognized image signature regardless of the
  // claimed type, since a mismatched-but-valid file is still processable.
  return isPng || isJpeg || isWebp;
}
