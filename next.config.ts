import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages ship native bindings, worker files, or WASM assets
  // (pdfjs-dist's pdf.worker.mjs, tesseract.js's core/worker files) that
  // Turbopack's server bundler doesn't carry over correctly. Marking them
  // external makes Next.js require() them from node_modules at runtime
  // instead of bundling — the standard fix for this class of issue and
  // what Vercel's own serverless functions expect for these packages.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "pdf-to-img",
    "tesseract.js",
    "tesseract.js-core",
    "@napi-rs/canvas",
  ],
  // serverExternalPackages stops Next from bundling these, but Vercel's own
  // file tracer (@vercel/nft) still decides what actually ships in each
  // route's deployed bundle — and it can miss files that are only reached
  // through a runtime-conditional require() (like @napi-rs/canvas picking
  // its native .node binary by platform/arch) or a plain fs path built at
  // runtime (like tessdata/, read via path.join(process.cwd(), ...) rather
  // than a static import). Both are exactly the kind of thing that runs
  // fine with a full local node_modules and silently goes missing in a
  // traced serverless bundle. Force-including them here is the documented
  // fix for that gap.
  outputFileTracingIncludes: {
    "/api/extract": [
      // The full package, not just the native binary subpackages: Vercel's
      // tracer only found @napi-rs/canvas's package.json automatically,
      // not its actual entry files (index.js, js-binding.js, etc.) — it
      // fully traced pdf-parse's own *nested* copy of this package, but
      // only partially traced the top-level copy that pdfjs-dist resolves
      // to at runtime, and that partial trace is what a Vercel deploy
      // failed on ("Cannot find module '.../@napi-rs/canvas/index.js'").
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
      "./tessdata/**/*",
    ],
  },
};

export default nextConfig;
