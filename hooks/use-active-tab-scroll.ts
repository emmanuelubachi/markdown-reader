"use client";

import { useEffect, useRef } from "react";

import type { ReaderTab } from "@/lib/markdown/types";

export function useActiveTabScroll(
  activeTabId: string,
  tabs: ReaderTab[],
) {
  const activeTabRef = useRef<HTMLDivElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tabList = tabListRef.current;
    const activeTab = activeTabRef.current;

    if (!tabList || !activeTab) {
      return;
    }

    const scrollActiveTabIntoView = () =>
      scrollTabIntoView(tabList, activeTab);

    scrollActiveTabIntoView();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(scrollActiveTabIntoView);

    resizeObserver.observe(tabList);

    return () => resizeObserver.disconnect();
  }, [activeTabId, tabs]);

  return { activeTabRef, tabListRef };
}

function scrollTabIntoView(
  tabList: HTMLDivElement,
  activeTab: HTMLDivElement,
) {
  const tabListBounds = tabList.getBoundingClientRect();
  const activeTabBounds = activeTab.getBoundingClientRect();
  let nextScrollLeft: number | null = null;

  if (activeTabBounds.left < tabListBounds.left) {
    nextScrollLeft =
      tabList.scrollLeft + activeTabBounds.left - tabListBounds.left;
  } else if (activeTabBounds.right > tabListBounds.right) {
    nextScrollLeft =
      tabList.scrollLeft + activeTabBounds.right - tabListBounds.right;
  }

  if (nextScrollLeft !== null) {
    tabList.scrollTo({
      behavior: "smooth",
      left: nextScrollLeft,
    });
  }
}
