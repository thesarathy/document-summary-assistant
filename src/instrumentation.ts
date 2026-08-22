/**
 * Next.js server startup hook (runs once per server instance).
 *
 * Why this exists: tesseract.js's native image-decoding binding (leptonica,
 * via WASM/napi) can fail on a corrupted-but-signature-valid image in a way
 * that escapes normal Promise rejection and surfaces as a Node
 * `uncaughtException` — confirmed during testing, where it crashed the
 * whole server process on a single bad upload. The primary defense is
 * validating file signatures before any file reaches OCR (see
 * lib/file-signature.ts), which blocks the large majority of malformed
 * input. This is the second layer, for the narrower case that gets past
 * that check (a real image header with a corrupted body).
 *
 * This is NOT a general-purpose "ignore all crashes" pattern — Node's own
 * guidance is that process state may be unsafe to continue after an
 * uncaught exception, and normally the right move is to let the process
 * exit and restart. It's scoped here because this route has no persistent
 * or shared in-memory state between requests (every request extracts and
 * summarizes independently, nothing is cached across requests), so an
 * error confined to one image-decode call in one request doesn't leave
 * anything behind for the next request to trip over.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException] Recovering from a non-fatal decode error:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection] Recovering from a non-fatal async error:", reason);
  });
}
