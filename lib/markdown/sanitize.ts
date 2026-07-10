export function sanitizeHref(rawHref: string) {
  const href = rawHref.trim();

  if (!href || href.startsWith("//") || /[\u0000-\u001F\u007F]/.test(href)) {
    return null;
  }

  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)) {
    return href;
  }

  if (href.startsWith("#") || href.startsWith("/")) {
    return href;
  }

  try {
    const url = new URL(href);
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];

    return allowedProtocols.includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

export function sanitizeImageSrc(rawSrc: string) {
  const src = rawSrc.trim();

  if (!src) {
    return null;
  }

  // The reader promises that opening a document does not contact hosts named by
  // that document. Keep images self-contained and restrict inline data to
  // raster formats; SVG can reference external resources of its own.
  return /^data:image\/(?:avif|gif|jpe?g|png|webp)(?:;[^,]*)?,/i.test(src)
    ? src
    : null;
}
