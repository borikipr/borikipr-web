import path from "node:path";
import { pathToFileURL } from "node:url";

export type RenderedPdfPage = Readonly<{
  pageIndex: number;
  width: number;
  height: number;
  pngBytes: Uint8Array;
  rgba: Uint8ClampedArray;
}>;

export async function renderPdfWithPdfJs(
  bytes: Uint8Array,
  scale = 1.5
): Promise<readonly RenderedPdfPage[]> {
  const [pdfjs, { createCanvas }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("@napi-rs/canvas"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: `${path
      .resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")
      .replaceAll("\\", "/")}/`,
    useSystemFonts: false,
  });
  const document = await loadingTask.promise;
  const rendered: RenderedPdfPage[] = [];
  try {
    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
      const page = await document.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const rgba = context.getImageData(0, 0, width, height).data;
      rendered.push({
        pageIndex,
        width,
        height,
        pngBytes: new Uint8Array(canvas.toBuffer("image/png")),
        rgba: new Uint8ClampedArray(rgba),
      });
      page.cleanup();
    }
    return rendered;
  } finally {
    await loadingTask.destroy();
  }
}
