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

  try {
    const url = new URL(src);
    const isRemoteImage = ["http:", "https:"].includes(url.protocol);
    const isInlineImage =
      url.protocol === "data:" && src.toLowerCase().startsWith("data:image/");

    return isRemoteImage || isInlineImage ? src : null;
  } catch {
    return null;
  }
}
