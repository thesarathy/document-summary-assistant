# Document Summary Assistant

**Live app: [document-summary-assistant-amber.vercel.app](https://document-summary-assistant-amber.vercel.app/)**

Upload a PDF or image, get a faithful, length-controlled summary with key points — extracted and summarized without inventing anything that isn't on the page.

Built for a technical assessment with an 8-hour time budget. This README explains what was actually built and why, not a generic feature list.

## Overview

The app accepts a PDF or image, extracts its text (falling back to OCR automatically when a PDF has no usable text layer, or when the upload is an image), and generates a short/medium/long summary with key points using an LLM. Everything runs in one Next.js app — no separate backend, no database, nothing persisted after the response.

## Features

- Drag-and-drop or file-picker upload, with client- and server-side validation
- PDF text extraction that preserves paragraph structure
- Automatic OCR fallback for scanned PDFs (no usable text layer) and direct OCR for image uploads
- Short / medium / long summaries with substantive, non-generic key points
- Change summary length without re-uploading (cached extracted text, re-summarize only)
- Copy summary / download as `.txt`
- Real staged loading states (uploading → extracting/OCR → summarizing), not a generic spinner
- Human-readable error states for every failure mode below, with retry / start-over actions
- Keyboard-accessible upload control, visible focus states, semantic HTML
- Responsive down to mobile

## Architecture

Single Next.js (App Router) application, deployed as one unit:

```
Upload (drag-drop or picker)
  -> POST /api/extract   -> PDF text layer, or OCR fallback -> { text, method, ... }
  -> POST /api/summarize -> Groq LLM, structured JSON prompt -> { summary, keyPoints }
  -> UI renders result; changing length re-calls /api/summarize with the
     already-extracted text -- no re-upload, no re-extraction
```

No database, no auth, no file storage. Each request is processed in memory and discarded once the response is sent.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| PDF text extraction | `pdf-parse` v2 (wraps a current `pdfjs-dist`) |
| Scanned-PDF rasterization | `pdf-to-img` (also `pdfjs-dist`-based) |
| OCR | `tesseract.js`, with the English model bundled locally in `/tessdata` |
| Summarization | Groq API (`openai/gpt-oss-120b`) |
| Hosting | Vercel |

## Why This Stack

**One Next.js app, not a separate frontend/backend.** The assignment explicitly allows any stack and doesn't reward extra infrastructure. Two deployments would mean CORS, two sets of environment variables, and a second cold-start path -- none of which improves the product. API routes give the same separation of concerns inside one deployable unit.

**`pdf-parse` v2, not v1.** v1 (the version most tutorials reference) bundles a `pdf.js` from ~2018 that fails outright on PDFs with modern compression -- confirmed by testing it against a freshly generated PDF, which it couldn't read at all. v2 wraps a current `pdfjs-dist`, which is what real-world PDFs (from Word, LaTeX, Chrome print-to-PDF) actually need.

**`pdfjs-dist` pinned via `overrides`.** Installing `pdf-to-img` pulled in a `pdfjs-dist` version with a known high-severity advisory (arbitrary JS execution when opening a malicious PDF) -- directly relevant since every upload here is untrusted input. Pinned to the patched `6.2.108` in `package.json`.

**`@napi-rs/canvas` installed explicitly, not left implicit.** `pdfjs-dist` needs a real canvas backend to render/extract in Node; without one, it silently falls back to broken browser-API polyfills (`Cannot polyfill Path2D`, `DOMMatrix`) and every PDF request fails. This didn't show up in initial local testing because it can appear to work right up until the actual rendering path is hit, and it's exactly the kind of gap that surfaces on a real deploy rather than a dev machine — installed as a direct dependency and marked external (see next.config.ts) so its native binary is included in the deployed bundle rather than assumed to already be present.

**Tesseract's trained data bundled locally, not fetched from a CDN at runtime.** `tesseract.js` defaults to downloading its language model from `cdn.jsdelivr.net` on first use. That's an unnecessary external dependency for something the deployment already knows it needs -- bundled the English model in `/tessdata` instead, loaded via a local path.

**Fonts self-hosted, not `next/font/google`.** Functionally equivalent, but removes a build-time dependency on Google Fonts' CDN being reachable -- one less way a deploy can fail for reasons unrelated to the code.

## How It Works

### Document Processing Pipeline

1. **Validate**: MIME type, file size (up to 4MB -- see Limitations), and actual file-signature bytes (magic numbers), not just the client-supplied MIME type, which can be wrong or spoofed.
2. **Extract**:
   - PDF: try the embedded text layer first (`pdf-parse`).
   - If the text layer is empty or under ~50 characters (`MIN_VIABLE_TEXT_LENGTH`), treat it as a scan: rasterize each page (`pdf-to-img`, capped at 8 pages) and OCR each one.
   - Image: OCR directly.
3. **Summarize**: send the extracted text to Groq with a structured prompt (see below), parse the JSON response, fall back to treating the raw response as the summary if the model doesn't return valid JSON.

### OCR Approach

`tesseract.js`, English model, bundled locally. A fresh worker is created and terminated per request (no long-lived worker pool -- this runs in serverless functions, so there's no persistent process to reuse one). Confirmed ~1s and 95%+ confidence on generated test images with printed text.

A file-signature check runs before anything reaches Tesseract: during testing, a corrupted-but-valid-header image caused Tesseract's native decoder to throw in a way that escaped normal `try/catch` and crashed the whole process. Validating the file's actual bytes against known PDF/PNG/JPEG/WEBP signatures closes most of that off; `src/instrumentation.ts` adds a narrow, documented `uncaughtException` handler as a second layer for whatever gets past it (safe here specifically because no state is shared across requests).

### Summarization Approach

The prompt explicitly instructs the model to summarize only what's supported by the text, never fabricate names/figures/conclusions, and return `{"summary": "...", "keyPoints": [...]}` -- length and key-point count vary by mode (short/medium/long), and the model is told the *depth* should differ, not just the word count. Documents beyond ~18,000 characters are map-reduced: chunked, each chunk summarized individually, then those summaries combined and given a final pass -- so there's no case where an unbounded amount of text gets sent in one call.

## Security

- File type validated by MIME type **and** actual byte signature (not just trusting the client)
- File size capped server-side (see Limitations for why 4MB specifically)
- `GROQ_API_KEY` read from environment only, never exposed to the client, never committed (`.env.example` provided, real `.env.local` gitignored)
- No documents or extracted text persisted anywhere -- processed per-request, discarded after the response
- Dependency pinned to patch a known PDF.js RCE advisory (see Tech Stack rationale above)

## Error Handling

Every stage has a specific, human-readable failure message (no stack traces reach the UI): empty file, oversized file, wrong file type, invalid/corrupt file signature, unreadable/password-protected PDF, OCR failure, insufficient extracted text, summarization-service unavailable, rate-limited, malformed model response, network failure. Each error state offers "Try again" (retries the failed stage only -- a summarization failure doesn't re-run extraction) and "Upload a different file."

## Local Setup

```bash
git clone <repo-url>
cd document-summary-assistant
npm install
cp .env.example .env.local
# add your GROQ_API_KEY to .env.local -- free key at https://console.groq.com/keys
```

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | Yes | Free tier at [console.groq.com](https://console.groq.com/keys). Without it, uploads still extract text but summarization returns a clear "not configured" error rather than crashing. **Free-tier accounts are rate-limited to 8,000 tokens/minute for `openai/gpt-oss-120b`** -- see Limitations for what this means in practice. |

## Running the Application

```bash
npm run dev     # development
npm run build   # production build
npm run start   # run the production build locally
```

## Testing

Tested with generated fixtures covering both success and failure paths, through the actual HTTP API (not just the underlying functions -- an earlier pass looked fine calling the extraction functions directly, but the real API route failed in the packaged server build; see Design Decisions):

- **Extraction**: multi-page text PDF, image-only "scanned" PDF (OCR fallback), direct image upload -- all verified via `/api/extract`
- **Failure paths**: empty file, oversized file (>4MB), corrupt/garbage-byte PDF, missing file, missing/invalid fields on `/api/summarize` -- all return the correct status code and message
- **Summarization logic**: JSON-parsing fallback (clean JSON, markdown-fenced JSON, malformed text, empty response), chunking, and the missing-API-key path -- unit-verified without live calls
- **UI**: full upload -> processing -> summary flow, length-toggle regeneration, copy/download actions, error states, both desktop and mobile viewports, keyboard focus visibility
- **Live end-to-end**: confirmed working against the deployed app with a real `GROQ_API_KEY` -- upload, extraction, and summarization all verified against actual Groq output, not just the logic around it.

## Deployment

Live at **[document-summary-assistant-amber.vercel.app](https://document-summary-assistant-amber.vercel.app/)**, deployed on Vercel.

To deploy your own instance:

```bash
npm i -g vercel
vercel
```

Or via the Vercel dashboard: import the GitHub repo, set the `GROQ_API_KEY` environment variable in Project Settings, deploy. No other configuration needed -- this is a single Next.js app with no separate services.

## Project Structure

```
src/
  app/
    page.tsx              # main UI state machine (idle/processing/summary/error)
    layout.tsx             # fonts, metadata
    api/
      extract/route.ts     # POST: file -> extracted text
      summarize/route.ts   # POST: text + length -> summary + key points
  components/
    UploadZone.tsx          # drag-and-drop / file picker
    ProcessingStatus.tsx    # staged loading state
    SummaryView.tsx          # summary + key points + length toggle + actions
    ErrorState.tsx
    DocumentGlyph.tsx        # signature scan-line processing icon
  lib/
    extract.ts               # orchestration: routes PDF/image to the right strategy
    extract-pdf.ts            # PDF text-layer extraction
    extract-ocr.ts             # Tesseract OCR
    rasterize-pdf.ts           # scanned-PDF page -> image, for OCR fallback
    summarize.ts                # Groq prompt, chunking, JSON parsing
    file-signature.ts           # magic-byte validation
    validation.ts                # file type/size validation
    types.ts                     # shared types and constants
  instrumentation.ts              # narrow crash-recovery hook (see Security)
tessdata/                         # bundled Tesseract English model
```

## Design Decisions

- **Extraction and summarization are separate API calls**, not one combined endpoint, specifically so changing the summary length doesn't require re-extracting (re-running OCR on every length change would be slow and wasteful).
- **Extraction was tested standalone before touching the API layer**, which caught a real bug the standalone tests didn't: `pdfjs-dist`'s worker file wasn't reachable from Turbopack's server bundle, so the library worked in isolation but the actual `/api/extract` route returned a 422 for every request. Fixed via `serverExternalPackages` in `next.config.ts`. Left in this README as a reminder that "the function works" and "the deployed route works" are different claims.
- **A page cap on scanned-PDF OCR** (`MAX_OCR_PAGES = 8`) rather than OCRing an arbitrarily long scan, to keep worst-case request time bounded on a serverless function.
- **No database, no auth, no persistence** -- not because they weren't considered, but because nothing in the assignment needs them, and adding them would just be surface area to get wrong in 8 hours.
- **Model name kept as a single constant, not hardcoded inline** (`MODEL` in `src/lib/summarize.ts`) -- LLM providers deprecate model IDs on their own schedule (Groq shut down the originally-used `llama-3.3-70b-versatile` on 08/16/26), so a request that worked yesterday can start failing with no code change on this end. Worth knowing as an operational reality of depending on a third-party model API, not a one-time bug.

## Limitations

- **4MB upload limit (code-enforced).** This isn't an arbitrary product choice -- Vercel serverless functions hard-cap request bodies at 4.5MB, so 4MB leaves headroom for multipart overhead. A larger limit would silently fail in production.
- **~50-60KB practical document size limit on a free-tier Groq key (not code-enforced -- a rate limit on Groq's side).** This is a separate, more restrictive ceiling than the 4MB upload cap above, and it's real-world rather than theoretical: confirmed by testing the deployed app. `openai/gpt-oss-120b` on Groq's free tier is limited to 8,000 tokens/minute; at roughly 4 characters per token in English, that's around 30-32K characters of extracted text before the prompt's own instructions and the summary's completion tokens are even counted. A file above ~55KB reliably extracts fine but then fails at the summarization step with a rate-limit error. This isn't a bug to fix in code -- it's the free tier's real capacity, and it goes away on a paid Groq plan. Large documents are already chunked (see How It Works) specifically to keep this manageable, but chunking reduces per-request size, not total tokens used across the whole document, so it doesn't get around a hard per-minute ceiling.
- **Scanned PDFs cap at 8 OCR'd pages.** A longer scan will summarize only its first 8 pages; there's no chunked/background processing for very long scans.
- **English OCR only.** `tesseract.js` supports other languages, but only English is bundled to keep the deploy size reasonable within the time budget.
- **No persistence.** Refreshing the page loses the current result by design (see Security) -- there's no history or saved documents.

## Future Improvements

- Support additional OCR languages (bundle selectively rather than all of them)
- Streaming the summary response instead of waiting for the full generation
- A "regenerate" action that varies the prompt slightly rather than only length switching
- Background processing for scanned PDFs beyond the current page cap