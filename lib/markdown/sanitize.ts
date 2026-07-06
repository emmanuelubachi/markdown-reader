export function sanitizeHref(rawHref: string) {
  if (rawHref.startsWith("#") || rawHref.startsWith("/")) {
    return rawHref;
  }

  try {
    const url = new URL(rawHref);
    const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];

    return allowedProtocols.includes(url.protocol) ? rawHref : null;
  } catch {
    return null;
  }
}

export function sanitizeImageSrc(rawSrc: string) {
  try {
    const url = new URL(rawSrc);
    const isRemoteImage = ["http:", "https:"].includes(url.protocol);
    const isInlineImage =
      url.protocol === "data:" &&
      rawSrc.toLowerCase().startsWith("data:image/");

    return isRemoteImage || isInlineImage ? rawSrc : null;
  } catch {
    return null;
  }
}
