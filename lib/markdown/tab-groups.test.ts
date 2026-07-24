import { describe, expect, it } from "vitest";

import {
  createTabGroupForTab,
  moveTabToGroup,
  normalizeTabGroupName,
  pruneEmptyTabGroups,
  ungroupTabs,
  updateTabGroup,
} from "@/lib/markdown/tab-groups";
import type {
  ReaderState,
  ReaderTab,
  ReaderTabGroup,
} from "@/lib/markdown/types";

function createTab(id: string, groupId: null | string = null): ReaderTab {
  return {
    activeHeadingId: null,
    error: null,
    file: null,
    groupId,
    id,
    view: "preview",
  };
}

function createGroup(id: string, name = id): ReaderTabGroup {
  return {
    collapsed: false,
    color: "cyan",
    id,
    name,
  };
}

describe("tab group operations", () => {
  it("creates a named group around one tab", () => {
    const state: ReaderState = {
      activeTabId: "b",
      groups: [],
      tabs: [createTab("a"), createTab("b")],
    };
    const nextState = createTabGroupForTab(state, "b");

    expect(nextState.groups).toHaveLength(1);
    expect(nextState.groups[0]).toMatchObject({
      collapsed: false,
      color: "cyan",
      name: "Group 1",
    });
    expect(nextState.tabs[1]?.groupId).toBe(nextState.groups[0]?.id);
  });

  it("moves tabs next to the target group and removes empty groups", () => {
    const state: ReaderState = {
      activeTabId: "c",
      groups: [createGroup("one"), createGroup("two")],
      tabs: [
        createTab("a", "one"),
        createTab("b", "two"),
        createTab("c", "one"),
      ],
    };
    const nextState = moveTabToGroup(state, "b", "one");

    expect(nextState.tabs.map((tab) => tab.id)).toEqual(["a", "c", "b"]);
    expect(nextState.tabs.every((tab) => tab.groupId === "one")).toBe(true);
    expect(nextState.groups.map((group) => group.id)).toEqual(["one"]);
  });

  it("removes a tab from its group without changing its position", () => {
    const state: ReaderState = {
      activeTabId: "b",
      groups: [createGroup("one")],
      tabs: [createTab("a", "one"), createTab("b", "one")],
    };
    const nextState = moveTabToGroup(state, "b", null);

    expect(nextState.tabs.map((tab) => tab.id)).toEqual(["a", "b"]);
    expect(nextState.tabs[1]?.groupId).toBeNull();
    expect(nextState.groups).toHaveLength(1);
  });

  it("renames, recolors, collapses, and ungroups a group", () => {
    const state: ReaderState = {
      activeTabId: "a",
      groups: [createGroup("one")],
      tabs: [createTab("a", "one")],
    };
    const updated = updateTabGroup(state, "one", {
      collapsed: true,
      color: "purple",
      name: "  Research   notes ",
    });

    expect(updated.groups[0]).toMatchObject({
      collapsed: true,
      color: "purple",
      name: "Research notes",
    });
    expect(ungroupTabs(updated, "one")).toEqual({
      ...updated,
      groups: [],
      tabs: [{ ...updated.tabs[0]!, groupId: null }],
    });
  });

  it("prunes groups with no remaining tabs and rejects blank names", () => {
    const state: ReaderState = {
      activeTabId: "a",
      groups: [createGroup("empty")],
      tabs: [createTab("a")],
    };

    expect(pruneEmptyTabGroups(state).groups).toEqual([]);
    expect(normalizeTabGroupName("   ")).toBeNull();
    expect(normalizeTabGroupName("  Product   docs ")).toBe("Product docs");
  });
});
