# Approach (200 words max)

**Problem**: build a document summarizer handling both text PDFs and scans, with length-controlled, faithful summaries, in 8 hours.

**Solution**: a single Next.js app (TypeScript, Tailwind) — no separate backend, since the extra deployment surface wasn't worth it here. PDF text is extracted directly (`pdf-parse`); when a PDF's text layer is empty or an image is uploaded, pages are rasterized and OCR'd with Tesseract, whose English model is bundled locally rather than fetched from a CDN at request time. Summaries come from Groq's `openai/gpt-oss-120b` via a prompt that forbids fabrication and requires structured JSON output (summary + key points); large documents are map-reduced through chunking rather than sent unbounded.

**UX**: staged status text (not a spinner), length changes reuse already-extracted text instead of re-uploading, and every failure mode — bad file, OCR failure, API error — gets a specific, human message with a retry action.

**Reliability**: uploads are validated by actual byte signature, not claimed MIME type; a known `pdfjs-dist` vulnerability pulled in transitively was found and pinned to a patched version; a serverless-bundling issue that broke the real API route despite working in isolated tests was caught by testing through the actual HTTP layer, not just library functions.
