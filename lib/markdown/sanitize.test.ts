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
  it("blocks remote and potentially networked image sources", () => {
    expect(sanitizeImageSrc("https://tracker.example/pixel.png")).toBeNull();
    expect(sanitizeImageSrc("http://127.0.0.1:4178/action")).toBeNull();
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
