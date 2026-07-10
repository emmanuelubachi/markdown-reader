import { describe, expect, it } from "vitest";

import { placeLoadedFileInReaderState } from "@/lib/markdown/document";
import type {
  LoadedFile,
  ReaderState,
  ReaderTab,
} from "@/lib/markdown/types";

const pastedFile: LoadedFile = {
  content: "# Pasted safely",
  lastModified: 123,
  name: "Pasted safely.md",
  size: 15,
  source: "paste",
};

function createTab(id: string, file: LoadedFile | null): ReaderTab {
  return {
    activeHeadingId: "old-heading",
    error: "old error",
    file,
    id,
    view: file ? "source" : "preview",
  };
}

describe("placeLoadedFileInReaderState", () => {
  it("reuses an empty target tab", () => {
    const state: ReaderState = {
      activeTabId: "empty",
      tabs: [createTab("empty", null)],
    };

    const nextState = placeLoadedFileInReaderState(
      state,
      pastedFile,
      "empty",
    );

    expect(nextState.activeTabId).toBe("empty");
    expect(nextState.tabs).toHaveLength(1);
    expect(nextState.tabs[0]).toMatchObject({
      activeHeadingId: null,
      error: null,
      file: pastedFile,
      view: "preview",
    });
  });

  it("opens a new tab instead of overwriting an existing document", () => {
    const originalFile: LoadedFile = {
      ...pastedFile,
      content: "# Keep me",
      name: "Keep me.md",
    };
    const originalTab = createTab("existing", originalFile);
    const state: ReaderState = {
      activeTabId: originalTab.id,
      tabs: [originalTab],
    };

    const nextState = placeLoadedFileInReaderState(
      state,
      pastedFile,
      originalTab.id,
    );

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.tabs[0]).toBe(originalTab);
    expect(nextState.tabs[0]?.file).toBe(originalFile);
    expect(nextState.tabs[1]?.file).toBe(pastedFile);
    expect(nextState.activeTabId).toBe(nextState.tabs[1]?.id);
  });

  it("opens a new tab when the requested target no longer exists", () => {
    const state: ReaderState = {
      activeTabId: "existing",
      tabs: [createTab("existing", null)],
    };

    const nextState = placeLoadedFileInReaderState(
      state,
      pastedFile,
      "closed-tab",
    );

    expect(nextState.tabs).toHaveLength(2);
    expect(nextState.tabs[0]?.file).toBeNull();
    expect(nextState.tabs[1]?.file).toBe(pastedFile);
  });
});
