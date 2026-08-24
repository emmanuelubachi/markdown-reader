"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { loadPdfDocument } from "@/lib/pdf/pdfjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function PdfOriginalView({
  data,
  name,
  pageCount,
}: {
  data: ArrayBuffer;
  name: string;
  pageCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateWidth = () => setAvailableWidth(viewport.clientWidth);
    const observer = new ResizeObserver(updateWidth);

    updateWidth();
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let destroyDocument: (() => Promise<void>) | undefined;

    async function openDocument() {
      try {
        const loadingTask = await loadPdfDocument(data);

        destroyDocument = () => loadingTask.destroy();

        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        const document = await loadingTask.promise;

        if (!cancelled) {
          documentRef.current = document;
          setDocumentVersion((version) => version + 1);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The original PDF could not be opened.",
          );
          setIsRendering(false);
        }
      }
    }

    void openDocument();

    return () => {
      cancelled = true;
      documentRef.current = null;
      void destroyDocument?.();
    };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const document = documentRef.current;

    if (!canvas || !document || availableWidth <= 0) {
      return;
    }

    const pdfDocument = document;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    let cleanupPage: (() => void) | undefined;

    async function renderPage() {
      setError(null);
      setIsRendering(true);

      try {
        const page = await pdfDocument.getPage(pageNumber);

        cleanupPage = () => void page.cleanup();
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = Math.min(
          2,
          Math.max(0.25, (availableWidth - 32) / baseViewport.width),
        );
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const renderViewport = page.getViewport({
          scale: cssScale * outputScale,
        });
        const target = canvasRef.current;

        if (!target || cancelled) {
          return;
        }

        target.width = Math.floor(renderViewport.width);
        target.height = Math.floor(renderViewport.height);
        target.style.width = `${Math.floor(baseViewport.width * cssScale)}px`;
        target.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;

        const renderTask = page.render({
          canvas: target,
          viewport: renderViewport,
        });

        cancelRender = () => renderTask.cancel();
        await renderTask.promise;
        page.cleanup();
        cleanupPage = undefined;

        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "The original PDF page could not be rendered.",
          );
          setIsRendering(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      cancelRender?.();
      cleanupPage?.();
    };
  }, [availableWidth, documentVersion, pageNumber]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="flex h-12 shrink-0 items-center justify-center gap-2 border-b border-border/70 bg-background/80 px-3">
        <Button
          aria-label="Previous PDF page"
          disabled={pageNumber <= 1 || isRendering}
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span
          aria-live="polite"
          className="min-w-24 text-center text-sm font-medium tabular-nums"
        >
          Page {pageNumber} of {pageCount}
        </span>
        <Button
          aria-label="Next PDF page"
          disabled={pageNumber >= pageCount || isRendering}
          onClick={() =>
            setPageNumber((current) => Math.min(pageCount, current + 1))
          }
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6"
      >
        {error ? (
          <Alert className="mx-auto max-w-lg" variant="destructive">
            <AlertTitle>Original page unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <canvas
          ref={canvasRef}
          aria-label={`${name}, page ${pageNumber}`}
          className="mx-auto block max-w-full bg-white shadow-lg"
        />

        {isRendering && !error ? (
          <div className="absolute inset-0 grid place-items-center bg-background/55">
            <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <Spinner />
              Rendering page…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
