import { afterEach, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import {
  activateTab,
  closeTab,
  createWorkspace,
  openInWorkspace,
  readWorkspace,
  saveRestoreTabs,
  saveWorkspace,
  setSplitTab,
} from './workspace';

function payload(
  name: string,
  content = `# ${name}\n\n## Install\n\n### Windows`,
  documentId = name,
): DocumentPayload {
  return { fileName: `${name}.md`, filePath: `C:\\docs\\${name}.md`, documentId, content };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it('adds a new document and makes it active', () => {
  const next = openInWorkspace(createWorkspace(), payload('First'));
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

it('rejects the active tab when setting the split tab', () => {
  const workspace = openInWorkspace(
    openInWorkspace(createWorkspace(), payload('First')),
    payload('Second'),
  );
  const next = setSplitTab(workspace, workspace.activeTabId);
  expect(next.splitTabId).toBeNull();
  expect(next.activeTabId).toBe(workspace.activeTabId);
});

it('round-trips an empty workspace with tab restoration enabled by default', () => {
  expect(readWorkspace()).toEqual(createWorkspace(true));
});

it('migrates the old browser document into one tab', () => {
  const saved = payload('Saved', '# Saved\n\nReady', 'render-id');
  localStorage.setItem(
    'md-viewer-document-v1',
    JSON.stringify({
      fileName: saved.fileName,
      filePath: saved.filePath,
      documentId: saved.documentId,
      content: saved.content,
    }),
  );

  const next = readWorkspace();

  expect(next.restoreTabs).toBe(true);
  expect(next.tabs).toHaveLength(1);
  expect(next.activeTabId).toBe(next.tabs[0].tabId);
  expect(next.tabs[0].document).toEqual(saved);
  expect(next.tabs[0].scrollTop).toBe(0);
});

it('discards malformed tabs and normalizes scroll position', () => {
  const saved = payload('Saved', '# Saved\n\nReady', 'render-id');
  localStorage.setItem(
    'md-viewer-workspace-v1',
    JSON.stringify({
      tabs: [
        {
          tabId: 'good-tab',
          document: saved,
          documentKey: 'path:c:/docs/saved.md',
          scrollTop: 214,
        },
        null,
        { tabId: 42, document: { fileName: 'bad.md' } },
      ],
      activeTabId: 'good-tab',
      splitTabId: 'missing',
      restoreTabs: true,
    }),
  );

  const next = readWorkspace();

  expect(next.tabs).toHaveLength(1);
  expect(next.tabs[0].scrollTop).toBe(0);
  expect(next.activeTabId).toBe('good-tab');
  expect(next.splitTabId).toBeNull();
});

it('returns false when saving workspace storage fails', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });

  expect(saveWorkspace(createWorkspace())).toBe(false);
});

it('returns false when saving the restore preference fails', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });

  expect(saveRestoreTabs(false)).toBe(false);
});

it('preserves the active tab when it is explicitly activated', () => {
  const workspace = openInWorkspace(
    openInWorkspace(createWorkspace(), payload('First')),
    payload('Second'),
  );
  const next = activateTab(workspace, workspace.tabs[0].tabId);
  expect(next.activeTabId).toBe(workspace.tabs[0].tabId);
});
