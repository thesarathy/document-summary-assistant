/** Hard cap on pages OCR'd for a scanned PDF, to bound worst-case processing time. */
export const MAX_OCR_PAGES = 8;

/**
 * Renders PDF pages to PNG buffers. Used only as a fallback when the PDF has
 * no usable text layer (i.e. it's a scan), so we cap how many pages we
 * rasterize + OCR to keep a large scanned PDF from timing out the request.
 */
export async function rasterizePdfPages(
  buffer: Buffer,
  maxPages: number = MAX_OCR_PAGES
): Promise<Buffer[]> {
  const { pdf } = await import("pdf-to-img");

  const doc = await pdf(buffer, { scale: 2 });
  const pages: Buffer[] = [];

  let index = 0;
  for await (const page of doc) {
    if (index >= maxPages) break;
    pages.push(page as Buffer);
    index++;
  }

  return pages;
}
