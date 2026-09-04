import { afterEach, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import {
  activateTab,
  closeTab,
  createWorkspace,
  documentKey,
  openInWorkspace,
  readWorkspace,
  saveRestoreTabs,
  saveWorkspace,
  setSplitTab,
} from './workspace';

function payload(
  name: string,
  content = `# ${name}`,
  filePath = `C:\\docs\\${name}.md`,
): DocumentPayload {
  return { fileName: `${name}.md`, filePath, documentId: `${name}-render`, content };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('adds a new document and makes it active', () => {
  const first = payload('First');
  const next = openInWorkspace(createWorkspace(), first);
  expect(next.tabs).toHaveLength(1);
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});

it('activates an already-open document instead of duplicating it', () => {
  const first = payload('First');
  const opened = openInWorkspace(openInWorkspace(createWorkspace(), first), payload('Second'));
  const next = openInWorkspace(opened, { ...first, documentId: 'different-render-id' });
  expect(next.tabs).toHaveLength(2);
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});

it('closes the split tab and selects a safe active tab', () => {
  let workspace = openInWorkspace(createWorkspace(), payload('First'));
  workspace = openInWorkspace(workspace, payload('Second'));
  workspace = setSplitTab(workspace, workspace.tabs[1].tabId);
  const next = closeTab(workspace, workspace.tabs[1].tabId);
  expect(next.tabs).toHaveLength(1);
  expect(next.splitTabId).toBeNull();
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
});

it('creates a stable key from path or fallback content identity', () => {
  expect(documentKey(payload('Guide', '# Guide', 'C:\\Docs\\Guide.md'))).toBe(
    'path:c:/docs/guide.md',
  );
  expect(documentKey(payload('Draft', '# Hello', ''))).toBe('content:Draft.md\u0000# Hello');
});

it('activates an existing tab without changing order', () => {
  let workspace = openInWorkspace(createWorkspace(), payload('First'));
  workspace = openInWorkspace(workspace, payload('Second'));
  const next = activateTab(workspace, workspace.tabs[0].tabId);
  expect(next.tabs.map((tab) => tab.document.fileName)).toEqual(['First.md', 'Second.md']);
  expect(next.activeTabId).toBe(workspace.tabs[0].tabId);
});

it('chooses the previous tab when closing the active tab', () => {
  let workspace = openInWorkspace(createWorkspace(), payload('First'));
  workspace = openInWorkspace(workspace, payload('Second'));
  workspace = openInWorkspace(workspace, payload('Third'));
  const next = closeTab(workspace, workspace.tabs[2].tabId);
  expect(next.activeTabId).toBe(workspace.tabs[1].tabId);
});

it('clears split selection when it matches the active or an unknown tab', () => {
  let workspace = openInWorkspace(createWorkspace(), payload('First'));
  workspace = openInWorkspace(workspace, payload('Second'));
  expect(setSplitTab(workspace, workspace.activeTabId)).toEqual({ ...workspace, splitTabId: null });
  expect(setSplitTab(workspace, 'missing')).toEqual({ ...workspace, splitTabId: null });
});

it('restores a valid workspace snapshot without scroll positions', () => {
  localStorage.setItem(
    'md-viewer-workspace-v1',
    JSON.stringify({
      tabs: [
        {
          tabId: 'tab-1',
          document: payload('First'),
          documentKey: 'path:c:/docs/first.md',
          scrollTop: 240,
        },
      ],
      activeTabId: 'tab-1',
      splitTabId: 'tab-1',
    }),
  );
  localStorage.setItem('md-viewer-restore-tabs-v1', 'false');

  const workspace = readWorkspace();

  expect(workspace.restoreTabs).toBe(false);
  expect(workspace.tabs).toHaveLength(1);
  expect(workspace.tabs[0].scrollTop).toBe(0);
  expect(workspace.tabs[0].documentKey).toBe('path:c:/docs/first.md');
  expect(workspace.activeTabId).toBe('tab-1');
  expect(workspace.splitTabId).toBeNull();
});

it('migrates the legacy browser document into a single tab', () => {
  localStorage.setItem(
    'md-viewer-document-v1',
    JSON.stringify({
      fileName: 'Legacy.md',
      content: '# Legacy',
      documentId: 'legacy-render',
    }),
  );

  const workspace = readWorkspace();

  expect(workspace.restoreTabs).toBe(true);
  expect(workspace.tabs).toHaveLength(1);
  expect(workspace.tabs[0].document.fileName).toBe('Legacy.md');
  expect(workspace.tabs[0].document.documentId).toBe('legacy-render');
  expect(workspace.tabs[0].scrollTop).toBe(0);
  expect(workspace.activeTabId).toBe(workspace.tabs[0].tabId);
});

it('drops malformed tabs instead of throwing', () => {
  localStorage.setItem(
    'md-viewer-workspace-v1',
    JSON.stringify({
      tabs: [
        {
          tabId: 'good',
          document: payload('Good'),
          documentKey: 'path:c:/docs/good.md',
          scrollTop: 18,
        },
        {
          tabId: 'bad',
          document: { fileName: 'Bad.md', content: 42, documentId: 'bad', filePath: '' },
          documentKey: 'content:bad',
          scrollTop: 55,
        },
      ],
      activeTabId: 'bad',
      splitTabId: 'bad',
    }),
  );

  const workspace = readWorkspace();

  expect(workspace.tabs).toHaveLength(1);
  expect(workspace.tabs[0].tabId).toBe('good');
  expect(workspace.activeTabId).toBe('good');
  expect(workspace.splitTabId).toBeNull();
});

it('returns an empty workspace when persisted data is malformed or storage throws', () => {
  localStorage.setItem('md-viewer-workspace-v1', '{');
  expect(readWorkspace()).toEqual(createWorkspace(true));

  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(readWorkspace()).toEqual(createWorkspace(true));
});

it('saves workspace snapshots without scroll positions and reports storage failures', () => {
  let workspace = openInWorkspace(createWorkspace(false), payload('First'));
  workspace = {
    ...workspace,
    splitTabId: workspace.tabs[0].tabId,
    tabs: workspace.tabs.map((tab) => ({ ...tab, scrollTop: 320 })),
  };

  expect(saveWorkspace(workspace)).toBe(true);
  expect(JSON.parse(localStorage.getItem('md-viewer-workspace-v1') ?? 'null')).toEqual({
    tabs: [
      {
        tabId: workspace.tabs[0].tabId,
        document: workspace.tabs[0].document,
        documentKey: workspace.tabs[0].documentKey,
      },
    ],
    activeTabId: workspace.activeTabId,
    splitTabId: workspace.splitTabId,
  });

  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(saveWorkspace(workspace)).toBe(false);
});

it('persists an empty workspace so legacy documents are not restored again', () => {
  localStorage.setItem(
    'md-viewer-document-v1',
    JSON.stringify({
      fileName: 'Legacy.md',
      content: '# Legacy',
      documentId: 'legacy-render',
    }),
  );

  expect(saveWorkspace(createWorkspace())).toBe(true);
  expect(JSON.parse(localStorage.getItem('md-viewer-workspace-v1') ?? 'null')).toEqual({
    tabs: [],
    activeTabId: null,
    splitTabId: null,
  });
  expect(readWorkspace()).toEqual(createWorkspace(true));
});

it('migrates a legacy browser document when the workspace record is invalid', () => {
  localStorage.setItem(
    'md-viewer-document-v1',
    JSON.stringify({
      fileName: 'Legacy.md',
      content: '# Legacy',
      documentId: 'legacy-render',
    }),
  );
  localStorage.setItem('md-viewer-workspace-v1', '{');

  const workspace = readWorkspace();

  expect(workspace.tabs).toHaveLength(1);
  expect(workspace.tabs[0].document.fileName).toBe('Legacy.md');
});

it('persists the restore-tabs preference and reports storage failures', () => {
  expect(saveRestoreTabs(false)).toBe(true);
  expect(localStorage.getItem('md-viewer-restore-tabs-v1')).toBe('false');

  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  expect(saveRestoreTabs(true)).toBe(false);
});
