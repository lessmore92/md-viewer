import type { DocumentPayload } from '../../electron/contracts';

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

const workspaceKey = 'md-viewer-workspace-v1';
const restoreTabsKey = 'md-viewer-restore-tabs-v1';
const legacyDocumentKey = 'md-viewer-document-v1';

export function documentKey(document: DocumentPayload): string {
  if (document.filePath) return `path:${document.filePath.replaceAll('\\', '/').toLowerCase()}`;
  return `content:${document.fileName}\u0000${document.content}`;
}

export function createWorkspace(restoreTabs = false): WorkspaceState {
  return { tabs: [], activeTabId: null, splitTabId: null, restoreTabs };
}

function createTab(document: DocumentPayload): WorkspaceTab {
  return {
    tabId:
      globalThis.crypto?.randomUUID?.() ??
      `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    document,
    documentKey: documentKey(document),
    scrollTop: 0,
  };
}

function parseJson(value: string | null): unknown {
  if (value === null) return null;
  return JSON.parse(value);
}

function isDocumentPayload(value: unknown): value is DocumentPayload {
  return !!value && typeof value === 'object' && typeof (value as DocumentPayload).fileName === 'string' && typeof (value as DocumentPayload).content === 'string' && typeof (value as DocumentPayload).documentId === 'string' && typeof (value as DocumentPayload).filePath === 'string';
}

function readStoredBoolean(key: string): boolean | undefined {
  try {
    const value = parseJson(localStorage.getItem(key));
    return typeof value === 'boolean' ? value : undefined;
  } catch {
    return undefined;
  }
}

function readStoredWorkspace(): WorkspaceState | null {
  try {
    const value = parseJson(localStorage.getItem(workspaceKey));
    if (!value || typeof value !== 'object') return null;
    const tabs = Array.isArray((value as { tabs?: unknown }).tabs)
      ? (value as { tabs: unknown[] }).tabs.flatMap((tab) => {
          if (!tab || typeof tab !== 'object') return [];
          const storedTab = tab as Partial<WorkspaceTab>;
          if (
            typeof storedTab.tabId !== 'string' ||
            !isDocumentPayload(storedTab.document)
          )
            return [];
          return [
            {
              tabId: storedTab.tabId,
              document: storedTab.document,
              documentKey:
                typeof storedTab.documentKey === 'string'
                  ? storedTab.documentKey
                  : documentKey(storedTab.document),
              scrollTop: 0,
            },
          ];
        })
      : [];
    const activeTabId =
      typeof (value as { activeTabId?: unknown }).activeTabId === 'string'
        ? (value as { activeTabId: string }).activeTabId
        : null;
    const splitTabId =
      typeof (value as { splitTabId?: unknown }).splitTabId === 'string'
        ? (value as { splitTabId: string }).splitTabId
        : null;
    const restoreTabs =
      typeof (value as { restoreTabs?: unknown }).restoreTabs === 'boolean'
        ? (value as { restoreTabs: boolean }).restoreTabs
        : true;
    return { tabs, activeTabId, splitTabId, restoreTabs };
  } catch {
    return null;
  }
}

function normalizeWorkspace(workspace: WorkspaceState): WorkspaceState {
  const tabs = workspace.tabs.map((tab) => ({
    ...tab,
    documentKey: documentKey(tab.document),
    scrollTop: 0,
  }));
  if (!tabs.length) return { ...createWorkspace(workspace.restoreTabs), restoreTabs: workspace.restoreTabs };
  const tabIds = new Set(tabs.map((tab) => tab.tabId));
  const activeTabId = tabIds.has(workspace.activeTabId ?? '') ? workspace.activeTabId : tabs[0].tabId;
  const splitTabId =
    workspace.splitTabId && tabIds.has(workspace.splitTabId) && workspace.splitTabId !== activeTabId
      ? workspace.splitTabId
      : null;
  return { tabs, activeTabId, splitTabId, restoreTabs: workspace.restoreTabs };
}

function makeWorkspaceFromDocument(document: DocumentPayload, restoreTabs: boolean): WorkspaceState {
  return normalizeWorkspace({
    ...createWorkspace(restoreTabs),
    tabs: [createTab(document)],
    activeTabId: null,
    splitTabId: null,
  });
}

function findTabIndex(workspace: WorkspaceState, tabId: string): number {
  return workspace.tabs.findIndex((tab) => tab.tabId === tabId);
}

export function openInWorkspace(workspace: WorkspaceState, document: DocumentPayload): WorkspaceState {
  const key = documentKey(document);
  const index = workspace.tabs.findIndex((tab) => tab.documentKey === key);
  if (index === -1) {
    const tab = createTab(document);
    return normalizeWorkspace({
      ...workspace,
      tabs: [...workspace.tabs, tab],
      activeTabId: tab.tabId,
    });
  }
  const tabs = workspace.tabs.slice();
  tabs[index] = {
    ...tabs[index],
    document,
    documentKey: key,
  };
  return normalizeWorkspace({ ...workspace, tabs, activeTabId: tabs[index].tabId });
}

export function activateTab(workspace: WorkspaceState, tabId: string): WorkspaceState {
  if (findTabIndex(workspace, tabId) === -1) return workspace;
  return normalizeWorkspace({ ...workspace, activeTabId: tabId });
}

export function closeTab(workspace: WorkspaceState, tabId: string): WorkspaceState {
  const index = findTabIndex(workspace, tabId);
  if (index === -1) return workspace;
  const tabs = workspace.tabs.filter((tab) => tab.tabId !== tabId);
  if (!tabs.length) return createWorkspace(workspace.restoreTabs);

  const nextWorkspace: WorkspaceState = {
    ...workspace,
    tabs,
    splitTabId: workspace.splitTabId === tabId ? null : workspace.splitTabId,
    activeTabId: workspace.activeTabId === tabId ? tabs[Math.max(0, index - 1)]?.tabId ?? tabs[0].tabId : workspace.activeTabId,
  };
  return normalizeWorkspace(nextWorkspace);
}

export function setSplitTab(workspace: WorkspaceState, tabId: string | null): WorkspaceState {
  if (tabId === null) return normalizeWorkspace({ ...workspace, splitTabId: null });
  if (findTabIndex(workspace, tabId) === -1 || workspace.activeTabId === tabId) {
    return normalizeWorkspace({ ...workspace, splitTabId: null });
  }
  return normalizeWorkspace({ ...workspace, splitTabId: tabId });
}

export function readWorkspace(): WorkspaceState {
  const stored = readStoredWorkspace();
  const preference = readStoredBoolean(restoreTabsKey);
  const restoreTabs = preference ?? stored?.restoreTabs ?? true;
  if (!restoreTabs) return createWorkspace(false);

  if (stored && stored.tabs.length) {
    return normalizeWorkspace({
      ...stored,
      restoreTabs,
    });
  }

  try {
    const legacy = parseJson(localStorage.getItem(legacyDocumentKey));
    if (isDocumentPayload(legacy)) return makeWorkspaceFromDocument(legacy, restoreTabs);
  } catch {
    /* The old single-document storage is optional. */
  }

  return createWorkspace(restoreTabs);
}

export function saveWorkspace(workspace: WorkspaceState): boolean {
  try {
    localStorage.setItem(restoreTabsKey, JSON.stringify(workspace.restoreTabs));
    localStorage.setItem(
      workspaceKey,
      JSON.stringify({
        tabs: workspace.tabs.map((tab) => ({
          tabId: tab.tabId,
          document: tab.document,
          documentKey: documentKey(tab.document),
        })),
        activeTabId: workspace.activeTabId,
        splitTabId: workspace.splitTabId,
        restoreTabs: workspace.restoreTabs,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function saveRestoreTabs(value: boolean): boolean {
  try {
    localStorage.setItem(restoreTabsKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
