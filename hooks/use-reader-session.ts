"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createReaderTab,
  reorderReaderTabs,
} from "@/lib/markdown/document";
import {
  clearReaderSession as clearReaderSessionStorage,
  isReaderPersistenceAvailable,
  loadReaderSession,
  rememberActiveReaderTabId,
  saveReaderSession,
} from "@/lib/markdown/persistence";
import { pruneEmptyTabGroups } from "@/lib/markdown/tab-groups";
import type { ReaderState, ReaderTab } from "@/lib/markdown/types";

export type ReaderPersistenceStatus =
  | "error"
  | "restoring"
  | "saved"
  | "saving"
  | "unavailable";

type CommitOptions = {
  persistImmediately?: boolean;
};

const SAVE_INDICATOR_TIMEOUT_MS = 2500;

export function useReaderSession() {
  const didChangeBeforeRestoreRef = useRef(false);
  const persistenceAvailableRef = useRef(false);
  const readerStateRef = useRef<ReaderState | null>(null);
  const lastPersistedSignatureRef = useRef<null | string>(null);
  const saveIndicatorTimeoutRef = useRef<null | number>(null);
  const saveSequenceRef = useRef(0);
  const [isPersistenceReady, setIsPersistenceReady] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<ReaderPersistenceStatus>("restoring");
  const [readerState, setReaderState] = useState<ReaderState>(() => {
    const tab = createReaderTab();

    return {
      activeTabId: tab.id,
      groups: [],
      tabs: [tab],
    };
  });

  const clearSaveIndicatorTimeout = useCallback(() => {
    if (saveIndicatorTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(saveIndicatorTimeoutRef.current);
    saveIndicatorTimeoutRef.current = null;
  }, []);

  const showSavingIndicator = useCallback(
    (saveSequence: number) => {
      clearSaveIndicatorTimeout();
      setPersistenceStatus("saving");

      saveIndicatorTimeoutRef.current = window.setTimeout(() => {
        if (saveSequenceRef.current === saveSequence) {
          setPersistenceStatus("saved");
        }
      }, SAVE_INDICATOR_TIMEOUT_MS);
    },
    [clearSaveIndicatorTimeout],
  );

  useEffect(() => {
    readerStateRef.current = readerState;
  }, [readerState]);

  useEffect(
    () => () => clearSaveIndicatorTimeout(),
    [clearSaveIndicatorTimeout],
  );

  // Exclude transient UI state such as the scroll-driven active heading.
  const persistenceSignature = useMemo(
    () => getReaderPersistenceSignature(readerState),
    [readerState],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!isReaderPersistenceAvailable()) {
      persistenceAvailableRef.current = false;
      const unavailableStatusId = window.setTimeout(() => {
        if (!isCancelled) {
          setPersistenceStatus("unavailable");
          setIsPersistenceReady(true);
        }
      }, 0);

      return () => window.clearTimeout(unavailableStatusId);
    }

    persistenceAvailableRef.current = true;
    void loadReaderSession()
      .then((session) => {
        if (isCancelled) {
          return;
        }

        if (session && !didChangeBeforeRestoreRef.current) {
          readerStateRef.current = session.state;
          lastPersistedSignatureRef.current = getReaderPersistenceSignature(
            session.state,
          );
          setReaderState(session.state);
          setPersistenceStatus("saved");
        } else {
          setPersistenceStatus("saving");
        }

        setIsPersistenceReady(true);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setPersistenceStatus("error");
        setIsPersistenceReady(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isPersistenceReady || !persistenceAvailableRef.current) {
      return;
    }

    if (persistenceSignature === lastPersistedSignatureRef.current) {
      return;
    }

    const saveSequence = saveSequenceRef.current + 1;

    saveSequenceRef.current = saveSequence;
    const statusTimeoutId = window.setTimeout(
      () => showSavingIndicator(saveSequence),
      0,
    );

    const timeoutId = window.setTimeout(() => {
      const stateToSave = readerStateRef.current;

      if (!stateToSave) {
        return;
      }

      void saveReaderSession(stateToSave)
        .then((savedAt) => {
          if (saveSequenceRef.current !== saveSequence) {
            return;
          }

          if (savedAt) {
            lastPersistedSignatureRef.current = persistenceSignature;
            clearSaveIndicatorTimeout();
            setPersistenceStatus("saved");
          } else {
            clearSaveIndicatorTimeout();
            setPersistenceStatus("unavailable");
          }
        })
        .catch(() => {
          if (saveSequenceRef.current === saveSequence) {
            clearSaveIndicatorTimeout();
            setPersistenceStatus("error");
          }
        });
    }, 450);

    return () => {
      window.clearTimeout(statusTimeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [
    clearSaveIndicatorTimeout,
    isPersistenceReady,
    persistenceSignature,
    showSavingIndicator,
  ]);

  function getCurrentReaderState() {
    return readerStateRef.current ?? readerState;
  }

  function persistReaderStateImmediately(nextState: ReaderState) {
    rememberActiveReaderTabId(nextState.activeTabId);

    if (!persistenceAvailableRef.current) {
      return;
    }

    const signature = getReaderPersistenceSignature(nextState);

    // The autosave effect observes the same state change, so record its
    // signature up front to avoid a redundant debounced write.
    lastPersistedSignatureRef.current = signature;

    const saveSequence = saveSequenceRef.current + 1;

    saveSequenceRef.current = saveSequence;
    showSavingIndicator(saveSequence);

    void saveReaderSession(nextState)
      .then((savedAt) => {
        if (saveSequenceRef.current !== saveSequence) {
          return;
        }

        if (savedAt) {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("saved");
        } else {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("unavailable");
        }
      })
      .catch(() => {
        if (lastPersistedSignatureRef.current === signature) {
          lastPersistedSignatureRef.current = null;
        }

        if (saveSequenceRef.current === saveSequence) {
          clearSaveIndicatorTimeout();
          setPersistenceStatus("error");
        }
      });
  }

  function commitReaderState(
    nextState: ReaderState,
    options: CommitOptions = {},
  ) {
    didChangeBeforeRestoreRef.current = true;
    readerStateRef.current = nextState;
    setReaderState(nextState);
    rememberActiveReaderTabId(nextState.activeTabId);

    if (options.persistImmediately) {
      persistReaderStateImmediately(nextState);
    }
  }

  function updateTab(
    tabId: string,
    updates: Partial<ReaderTab>,
    options: CommitOptions = {},
  ) {
    const currentState = getCurrentReaderState();

    if (!currentState.tabs.some((tab) => tab.id === tabId)) {
      return;
    }

    commitReaderState(
      {
        ...currentState,
        tabs: currentState.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updates } : tab,
        ),
      },
      options,
    );
  }

  function reorderTabs(
    movedTabId: string,
    targetTabId: string,
    placement: "after" | "before",
  ) {
    const currentState = getCurrentReaderState();
    const movedTab = currentState.tabs.find((tab) => tab.id === movedTabId);
    const targetTab = currentState.tabs.find((tab) => tab.id === targetTabId);
    let nextState = reorderReaderTabs(
      currentState,
      movedTabId,
      targetTabId,
      placement,
    );

    if (
      nextState !== currentState &&
      movedTab &&
      targetTab &&
      movedTab.groupId !== targetTab.groupId
    ) {
      nextState = pruneEmptyTabGroups({
        ...nextState,
        tabs: nextState.tabs.map((tab) =>
          tab.id === movedTabId
            ? { ...tab, groupId: targetTab.groupId }
            : tab,
        ),
      });
    }

    if (nextState !== currentState) {
      commitReaderState(nextState, { persistImmediately: true });
    }
  }

  async function clearReaderSession() {
    const freshTab = createReaderTab();
    const nextState: ReaderState = {
      activeTabId: freshTab.id,
      groups: [],
      tabs: [freshTab],
    };

    didChangeBeforeRestoreRef.current = true;
    readerStateRef.current = nextState;
    lastPersistedSignatureRef.current =
      getReaderPersistenceSignature(nextState);
    setReaderState(nextState);
    rememberActiveReaderTabId(nextState.activeTabId);

    try {
      await clearReaderSessionStorage();
      setPersistenceStatus(
        persistenceAvailableRef.current ? "saved" : "unavailable",
      );
    } catch {
      setPersistenceStatus("error");
    }
  }

  return {
    clearReaderSession,
    commitReaderState,
    getCurrentReaderState,
    persistenceStatus,
    readerState,
    reorderTabs,
    updateTab,
  };
}

// Cheap fingerprint of everything that must be persisted. File contents are
// represented by metadata because edits already update size and lastModified.
function getReaderPersistenceSignature(state: ReaderState) {
  const tabSignatures = state.tabs.map((tab) => {
    const file = tab.file;
    const fileSignature = file
      ? [file.name, file.size, file.lastModified, file.source].join("\u0000")
      : "";

    return [
      tab.id,
      tab.groupId ?? "",
      tab.view,
      tab.error ?? "",
      fileSignature,
    ].join("\u0001");
  });
  const groupSignatures = state.groups.map((group) =>
    [
      group.id,
      group.name,
      group.color,
      group.collapsed ? "collapsed" : "expanded",
    ].join("\u0001"),
  );

  return [state.activeTabId, ...groupSignatures, ...tabSignatures].join(
    "\u0002",
  );
}
