import type { DocumentPayload } from '../../electron/contracts';
import { browserDocumentStorageKey, restoreBrowserDocument } from './browserDocument';

export interface WorkspaceTab {
  tabId: string;
  document: DocumentPayload;
  documentKey: string;
  scrollTop: number;
}

export interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  splitTabId: string | null;
  restoreTabs: boolean;
}

const workspaceStorageKey = 'md-viewer-workspace-v1';
const restoreTabsStorageKey = 'md-viewer-restore-tabs-v1';

function createTabId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function hasOwn(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && key in value;
}

function isDocumentPayload(value: unknown): value is DocumentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    hasOwn(value, 'fileName') &&
    typeof value.fileName === 'string' &&
    hasOwn(value, 'filePath') &&
    typeof value.filePath === 'string' &&
    hasOwn(value, 'content') &&
    typeof value.content === 'string' &&
    hasOwn(value, 'documentId') &&
    typeof value.documentId === 'string'
  );
}

function normalizeActiveTabId(tabs: WorkspaceTab[], activeTabId: string | null): string | null {
  if (activeTabId && tabs.some((tab) => tab.tabId === activeTabId)) return activeTabId;
  return tabs[0]?.tabId ?? null;
}

function normalizeSplitTabId(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  splitTabId: string | null,
): string | null {
  if (!splitTabId) return null;
  if (splitTabId === activeTabId) return null;
  return tabs.some((tab) => tab.tabId === splitTabId) ? splitTabId : null;
}

function restoreTabsPreference(): boolean {
  try {
    const value = localStorage.getItem(restoreTabsStorageKey);
    if (value === null) return true;
    return value === 'true';
  } catch {
    return true;
  }
}

function restoreTab(value: unknown): WorkspaceTab | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !hasOwn(value, 'tabId') ||
    typeof value.tabId !== 'string' ||
    !hasOwn(value, 'document') ||
    !isDocumentPayload(value.document)
  ) {
    return null;
  }

  return {
    tabId: value.tabId,
    document: value.document,
    documentKey: documentKey(value.document),
    scrollTop: 0,
  };
}

function migrateLegacyWorkspace(restoreTabs: boolean): WorkspaceState {
  const legacyDocument = restoreBrowserDocument();
  if (!legacyDocument) return createWorkspace(restoreTabs);

  return {
    ...openInWorkspace(createWorkspace(restoreTabs), legacyDocument),
    restoreTabs,
  };
}

export function createWorkspace(restoreTabs = true): WorkspaceState {
  return { tabs: [], activeTabId: null, splitTabId: null, restoreTabs };
}

export function documentKey(document: DocumentPayload): string {
  if (document.filePath) return `path:${document.filePath.replace(/\\/g, '/').toLowerCase()}`;
  return `content:${document.fileName}\u0000${document.content}`;
}

export function openInWorkspace(
  workspace: WorkspaceState,
  document: DocumentPayload,
): WorkspaceState {
  const key = documentKey(document);
  const existing = workspace.tabs.find((tab) => tab.documentKey === key);
  if (existing) {
    const tabs = workspace.tabs.map((tab) =>
      tab.tabId === existing.tabId ? { ...tab, document } : tab,
    );
    const activeTabId = existing.tabId;
    return {
      ...workspace,
      tabs,
      activeTabId,
      splitTabId: normalizeSplitTabId(tabs, activeTabId, workspace.splitTabId),
    };
  }

  const tab: WorkspaceTab = {
    tabId: createTabId(),
    document,
    documentKey: key,
    scrollTop: 0,
  };
  return {
    ...workspace,
    tabs: [...workspace.tabs, tab],
    activeTabId: tab.tabId,
    splitTabId: normalizeSplitTabId(workspace.tabs, tab.tabId, workspace.splitTabId),
  };
}

export function activateTab(workspace: WorkspaceState, tabId: string): WorkspaceState {
  if (!workspace.tabs.some((tab) => tab.tabId === tabId)) return workspace;
  return {
    ...workspace,
    activeTabId: tabId,
    splitTabId: normalizeSplitTabId(workspace.tabs, tabId, workspace.splitTabId),
  };
}

export function closeTab(workspace: WorkspaceState, tabId: string): WorkspaceState {
  const index = workspace.tabs.findIndex((tab) => tab.tabId === tabId);
  if (index === -1) return workspace;

  const tabs = workspace.tabs.filter((tab) => tab.tabId !== tabId);
  let activeTabId = workspace.activeTabId;
  if (workspace.activeTabId === tabId) {
    activeTabId = tabs[index - 1]?.tabId ?? tabs[0]?.tabId ?? null;
  } else if (activeTabId && !tabs.some((tab) => tab.tabId === activeTabId)) {
    activeTabId = tabs[0]?.tabId ?? null;
  }

  return {
    ...workspace,
    tabs,
    activeTabId,
    splitTabId: normalizeSplitTabId(
      tabs,
      activeTabId,
      workspace.splitTabId === tabId ? null : workspace.splitTabId,
    ),
  };
}

export function setSplitTab(workspace: WorkspaceState, tabId: string | null): WorkspaceState {
  if (!tabId) return { ...workspace, splitTabId: null };
  if (tabId === workspace.activeTabId) return { ...workspace, splitTabId: null };
  if (!workspace.tabs.some((tab) => tab.tabId === tabId)) return { ...workspace, splitTabId: null };
  return { ...workspace, splitTabId: tabId };
}

export function readWorkspace(): WorkspaceState {
  const restoreTabs = restoreTabsPreference();

  let raw: string | null;
  try {
    raw = localStorage.getItem(workspaceStorageKey);
  } catch {
    return createWorkspace(restoreTabs);
  }

  if (raw === null) return migrateLegacyWorkspace(restoreTabs);

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !hasOwn(parsed, 'tabs') ||
      !Array.isArray(parsed.tabs)
    ) {
      return migrateLegacyWorkspace(restoreTabs);
    }

    const tabs = parsed.tabs.map(restoreTab).filter((tab): tab is WorkspaceTab => tab !== null);
    const activeTabId = normalizeActiveTabId(
      tabs,
      hasOwn(parsed, 'activeTabId') &&
        (typeof parsed.activeTabId === 'string' || parsed.activeTabId === null)
        ? parsed.activeTabId
        : null,
    );
    const splitTabId = normalizeSplitTabId(
      tabs,
      activeTabId,
      hasOwn(parsed, 'splitTabId') &&
        (typeof parsed.splitTabId === 'string' || parsed.splitTabId === null)
        ? parsed.splitTabId
        : null,
    );

    return { tabs, activeTabId, splitTabId, restoreTabs };
  } catch {
    return migrateLegacyWorkspace(restoreTabs);
  }
}

export function saveWorkspace(workspace: WorkspaceState): boolean {
  try {
    localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify({
        tabs: workspace.tabs.map(({ tabId, document, documentKey: key }) => ({
          tabId,
          document,
          documentKey: key,
        })),
        activeTabId: workspace.activeTabId,
        splitTabId: workspace.splitTabId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function saveRestoreTabs(value: boolean): boolean {
  try {
    localStorage.setItem(restoreTabsStorageKey, String(value));
    return true;
  } catch {
    return false;
  }
}

export { browserDocumentStorageKey, restoreTabsStorageKey, workspaceStorageKey };
