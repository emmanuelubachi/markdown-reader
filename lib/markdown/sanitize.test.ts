import { describe, expect, it } from "vitest";

import { sanitizeHref, sanitizeImageSrc } from "@/lib/markdown/sanitize";

describe("sanitizeHref", () => {
  it("keeps safe links and anchors", () => {
    expect(sanitizeHref("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(sanitizeHref("#introduction")).toBe("#introduction");
  });

  it("blocks executable and protocol-relative links", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("//tracker.example/pixel")).toBeNull();
  });
});

describe("sanitizeImageSrc", () => {
  it("allows absolute HTTP(S) image sources", () => {
    expect(sanitizeImageSrc("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
    expect(sanitizeImageSrc("http://127.0.0.1:4178/image.png")).toBe(
      "http://127.0.0.1:4178/image.png",
    );
  });

  it("blocks unsafe, local, and potentially executable image sources", () => {
    expect(sanitizeImageSrc("javascript:alert(1)")).toBeNull();
    expect(sanitizeImageSrc("file:///etc/passwd")).toBeNull();
    expect(sanitizeImageSrc("//example.com/image.png")).toBeNull();
    expect(sanitizeImageSrc("./local-image.png")).toBeNull();
    expect(
      sanitizeImageSrc("data:image/svg+xml,<svg></svg>"),
    ).toBeNull();
  });

  it("allows self-contained raster data images", () => {
    expect(sanitizeImageSrc("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(sanitizeImageSrc("data:image/webp;base64,BBBB")).toBe(
      "data:image/webp;base64,BBBB",
    );
  });
});
