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

  if (!src || /[\u0000-\u001F\u007F]/.test(src)) {
    return null;
  }

  // Keep inline data restricted to raster formats; SVG can reference external
  // resources of its own. Ordinary web images are loaded directly by the
  // browser without uploading the Markdown document to the app server.
  if (/^data:image\/(?:avif|gif|jpe?g|png|webp)(?:;[^,]*)?,/i.test(src)) {
    return src;
  }

  try {
    const url = new URL(src);

    return url.protocol === "http:" || url.protocol === "https:" ? src : null;
  } catch {
    return null;
  }
}
