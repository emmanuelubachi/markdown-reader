import { createDocumentId } from "@/lib/markdown/document";
import type {
  ReaderState,
  ReaderTabGroup,
  ReaderTabGroupColor,
} from "@/lib/markdown/types";

export const READER_TAB_GROUP_COLORS: ReaderTabGroupColor[] = [
  "cyan",
  "blue",
  "green",
  "orange",
  "pink",
  "purple",
];

export function createTabGroupForTab(
  state: ReaderState,
  tabId: string,
): ReaderState {
  if (!state.tabs.some((tab) => tab.id === tabId)) {
    return state;
  }

  const group: ReaderTabGroup = {
    collapsed: false,
    color:
      READER_TAB_GROUP_COLORS[
        state.groups.length % READER_TAB_GROUP_COLORS.length
      ]!,
    id: createDocumentId(),
    name: getNextGroupName(state.groups),
  };

  return pruneEmptyTabGroups({
    ...state,
    groups: [...state.groups, group],
    tabs: state.tabs.map((tab) =>
      tab.id === tabId ? { ...tab, groupId: group.id } : tab,
    ),
  });
}

export function moveTabToGroup(
  state: ReaderState,
  tabId: string,
  groupId: null | string,
): ReaderState {
  const movedIndex = state.tabs.findIndex((tab) => tab.id === tabId);
  const movedTab = state.tabs[movedIndex];

  if (
    !movedTab ||
    movedTab.groupId === groupId ||
    (groupId !== null &&
      !state.groups.some((group) => group.id === groupId))
  ) {
    return state;
  }

  const tabsWithoutMoved = state.tabs.filter((tab) => tab.id !== tabId);
  const nextMovedTab = { ...movedTab, groupId };
  let insertionIndex = movedIndex;

  if (groupId !== null) {
    const lastGroupTabIndex = tabsWithoutMoved.findLastIndex(
      (tab) => tab.groupId === groupId,
    );

    insertionIndex =
      lastGroupTabIndex === -1
        ? Math.min(movedIndex, tabsWithoutMoved.length)
        : lastGroupTabIndex + 1;
  }

  const nextTabs = [...tabsWithoutMoved];

  nextTabs.splice(
    Math.min(Math.max(insertionIndex, 0), nextTabs.length),
    0,
    nextMovedTab,
  );

  return pruneEmptyTabGroups({
    ...state,
    groups:
      groupId === null
        ? state.groups
        : state.groups.map((group) =>
            group.id === groupId ? { ...group, collapsed: false } : group,
          ),
    tabs: nextTabs,
  });
}

export function updateTabGroup(
  state: ReaderState,
  groupId: string,
  updates: Partial<
    Pick<ReaderTabGroup, "collapsed" | "color" | "name">
  >,
): ReaderState {
  if (!state.groups.some((group) => group.id === groupId)) {
    return state;
  }

  const nextName =
    typeof updates.name === "string"
      ? normalizeTabGroupName(updates.name)
      : undefined;

  if (typeof updates.name === "string" && !nextName) {
    return state;
  }

  return {
    ...state,
    groups: state.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            ...updates,
            ...(nextName ? { name: nextName } : {}),
          }
        : group,
    ),
  };
}

export function ungroupTabs(state: ReaderState, groupId: string): ReaderState {
  if (!state.groups.some((group) => group.id === groupId)) {
    return state;
  }

  return {
    ...state,
    groups: state.groups.filter((group) => group.id !== groupId),
    tabs: state.tabs.map((tab) =>
      tab.groupId === groupId ? { ...tab, groupId: null } : tab,
    ),
  };
}

export function pruneEmptyTabGroups(state: ReaderState): ReaderState {
  const usedGroupIds = new Set(
    state.tabs.flatMap((tab) => (tab.groupId ? [tab.groupId] : [])),
  );
  const groups = state.groups.filter((group) => usedGroupIds.has(group.id));

  return groups.length === state.groups.length ? state : { ...state, groups };
}

export function normalizeTabGroupName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");

  return normalized ? normalized.slice(0, 40) : null;
}

function getNextGroupName(groups: ReaderTabGroup[]) {
  const existingNames = new Set(groups.map((group) => group.name));
  let index = groups.length + 1;
  let name = `Group ${index}`;

  while (existingNames.has(name)) {
    index += 1;
    name = `Group ${index}`;
  }

  return name;
}
