import "client-only";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function loadPdfJs() {
  pdfJsPromise ??= import("pdfjs-dist").then((pdfJs) => {
    pdfJs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    return pdfJs;
  });

  return pdfJsPromise;
}

export async function loadPdfDocument(data: ArrayBuffer) {
  const pdfJs = await loadPdfJs();

  // PDF.js transfers ownership of typed-array data to its worker. Always pass
  // a copy so the original remains available for the Original PDF view and
  // IndexedDB session persistence.
  return pdfJs.getDocument({ data: new Uint8Array(data.slice(0)) });
}
