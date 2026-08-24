import type { LoadedPdfFile } from "@/lib/markdown/types";
import { loadPdfDocument, loadPdfJs } from "@/lib/pdf/pdfjs";
import {
  extractPdfSourceTextHints,
  looksLikeTrackedCapitalText,
  restoreTrackedCapitalSpacing,
} from "@/lib/pdf/pdf-source-text";
import {
  escapeMarkdownText,
  pdfTextRunsToMarkdown,
  type PdfTextRun,
} from "@/lib/pdf/pdf-text";

export type PdfImportProgress = {
  page: number;
  totalPages: number;
};

export type PdfImportErrorCode =
  | "cancelled"
  | "invalid"
  | "no-text"
  | "password-protected";

export class PdfImportError extends Error {
  constructor(
    public readonly code: PdfImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfImportError";
  }
}

export async function importPdfFile(
  file: File,
  {
    onProgress,
    signal,
  }: {
    onProgress?: (progress: PdfImportProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<LoadedPdfFile> {
  throwIfAborted(signal);

  const originalData = await file.arrayBuffer();

  throwIfAborted(signal);
  const loadingTask = await loadPdfDocument(originalData);
  let passwordRequired = false;

  const abortLoading = () => {
    void loadingTask.destroy();
  };

  signal?.addEventListener("abort", abortLoading, { once: true });
  loadingTask.onPassword = () => {
    passwordRequired = true;
    void loadingTask.destroy();
  };

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      onProgress?.({ page: pageNumber, totalPages: document.numPages });

      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const needsSourceTextHints = textContent.items.some(
        (item) => "str" in item && looksLikeTrackedCapitalText(item.str),
      );
      const sourceTextHints = needsSourceTextHints
        ? extractPdfSourceTextHints(
            await page.getOperatorList(),
            (await loadPdfJs()).OPS,
          )
        : new Map<string, string>();
      const runs = textContent.items.flatMap((item): PdfTextRun[] => {
        if (!("str" in item)) {
          return [];
        }

        return [
          {
            fontFamily:
              textContent.styles[item.fontName]?.fontFamily ?? item.fontName,
            fontName: item.fontName,
            hasEOL: item.hasEOL,
            height: item.height,
            text: restoreTrackedCapitalSpacing(item.str, sourceTextHints),
            width: item.width,
            x: Number(item.transform[4] ?? 0),
            y: Number(item.transform[5] ?? 0),
          },
        ];
      });
      const pageText = pdfTextRunsToMarkdown(runs);

      pages.push(
        [`## Page ${pageNumber}`, pageText || "*No extractable text on this page.*"]
          .join("\n\n")
          .trim(),
      );
      page.cleanup();
    }

    const extractedText = pages.join("\n\n").replace(
      /## Page \d+\n\n\*No extractable text on this page\.\*/g,
      "",
    );

    if (!extractedText.trim()) {
      throw new PdfImportError(
        "no-text",
        "This PDF does not contain extractable text. It may be a scanned document.",
      );
    }

    const title = file.name.replace(/\.pdf$/i, "") || "PDF document";
    const content = [
      `# ${escapeMarkdownText(title)}`,
      ...pages,
    ].join("\n\n");

    return {
      content,
      kind: "pdf",
      lastModified: file.lastModified,
      name: file.name,
      originalData,
      pageCount: document.numPages,
      size: file.size,
      source: "file",
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new PdfImportError("cancelled", "PDF import was cancelled.");
    }

    if (passwordRequired) {
      throw new PdfImportError(
        "password-protected",
        "Password-protected PDFs are not supported yet.",
      );
    }

    if (error instanceof PdfImportError) {
      throw error;
    }

    throw new PdfImportError(
      "invalid",
      "The PDF could not be read. It may be damaged or unsupported.",
    );
  } finally {
    signal?.removeEventListener("abort", abortLoading);
    await loadingTask.destroy();
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new PdfImportError("cancelled", "PDF import was cancelled.");
  }
}
