import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DocumentPayload } from '../../electron/contracts';
import { DocumentPane } from '../components/DocumentPane';
import { TabBar } from '../components/TabBar';
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
import type { WorkspaceState } from './workspace';
import { Toolbar } from '../components/Toolbar';
import { ReadingToolbar } from '../components/ReadingToolbar';
import { Icon } from '../components/Icon';
import { applyTheme, readTheme, readStandardTheme, saveTheme } from './theme';
import type { Theme, StandardTheme } from './theme';
import { acceptedFiles, readBrowserFile } from './browserDocument';
import { defaultPreferences, readPreferences, savePreferences } from './readingPreferences';
import type { ReadingPreferences } from './readingPreferences';
import { useOffline } from './useOffline';
import sample from './sample.md?raw';

const narrowQuery = '(max-width: 960px)';

function initialWorkspace(): WorkspaceState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return createWorkspace();
    const saved = readWorkspace();
    if (!saved.restoreTabs) return createWorkspace(false);
    return window.matchMedia?.(narrowQuery).matches ? setSplitTab(saved, null) : saved;
  } catch {
    return createWorkspace();
  }
}

const paneStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
};

export default function App() {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const primaryTab = workspace.tabs.find((tab) => tab.tabId === workspace.activeTabId) ?? null;
  const secondaryTab = workspace.tabs.find((tab) => tab.tabId === workspace.splitTabId) ?? null;
  const doc = primaryTab?.document;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const [focus, setFocus] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const focusTrigger = useRef<HTMLDivElement>(null);
  const offline = useOffline();
  const [theme, setTheme] = useState(readTheme);
  const previousTheme = useRef<StandardTheme | null>(null);
  if (previousTheme.current === null)
    previousTheme.current = theme === 'ebook-reader' ? readStandardTheme() : theme;
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(narrowQuery).matches ?? false);
  const latestRequest = useRef(0);
  const pendingRequests = useRef(new Set<number>());
  const lastPersistedWorkspace = useRef<WorkspaceState | null>(null);
  const outlineId = useId();
  const [hasHeadings, setHasHeadings] = useState(false);

  const acceptDocument = useCallback((next: DocumentPayload, request?: number) => {
    if (request === undefined) {
      // An OS-opened document cancels dialog results that are no longer relevant.
      pendingRequests.current.clear();
      setLoading(false);
    }
    setWorkspace((current) => openInWorkspace(current, next));
    setError('');
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    const previous = lastPersistedWorkspace.current;
    // Scroll offsets are session-only; avoid rewriting document content on every scroll.
    if (
      previous &&
      previous.activeTabId === workspace.activeTabId &&
      previous.splitTabId === workspace.splitTabId &&
      previous.restoreTabs === workspace.restoreTabs &&
      previous.tabs.length === workspace.tabs.length &&
      previous.tabs.every(
        (tab, index) =>
          tab.tabId === workspace.tabs[index].tabId &&
          tab.document === workspace.tabs[index].document,
      )
    )
      return;
    lastPersistedWorkspace.current = workspace;
    const savedWorkspace = saveWorkspace(workspace);
    const savedPreference = saveRestoreTabs(workspace.restoreTabs);
    setStorageError(!savedWorkspace || !savedPreference);
  }, [workspace]);

  const changePreferences = (patch: Partial<ReadingPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    savePreferences(next);
  };

  const changeTheme = (next: Theme) => {
    if (next !== 'ebook-reader') previousTheme.current = next;
    setTheme(next);
  };

  const exitFocus = useCallback(() => {
    setFocus(false);
    requestAnimationFrame(() =>
      focusTrigger.current?.querySelector<HTMLButtonElement>('.focus-toggle')?.focus(),
    );
  }, []);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && focus) exitFocus();
      if (
        !window.electronAPI &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'o'
      ) {
        event.preventDefault();
        fileInput.current?.click();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [focus, exitFocus]);

  useEffect(() => {
    const pending = pendingRequests.current;
    const unsubscribe = window.electronAPI?.onDocumentOpened(acceptDocument);
    return () => {
      pending.clear();
      unsubscribe?.();
    };
  }, [acceptDocument]);

  useEffect(() => {
    const media = window.matchMedia?.(narrowQuery);
    if (!media) return;
    const update = () => {
      setNarrow(media.matches);
      setDrawerOpen(false);
      if (media.matches) setWorkspace((current) => setSplitTab(current, null));
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const runOpen = async (
    operation: () => Promise<DocumentPayload | null>,
    errorMessage: (reason: unknown) => string,
  ) => {
    const request = ++latestRequest.current;
    pendingRequests.current.add(request);
    setLoading(true);
    setError('');
    try {
      const next = await operation();
      if (pendingRequests.current.has(request) && next) acceptDocument(next, request);
    } catch (reason) {
      if (pendingRequests.current.has(request) && request === latestRequest.current)
        setError(errorMessage(reason));
    } finally {
      if (pendingRequests.current.delete(request)) setLoading(pendingRequests.current.size > 0);
    }
  };

  const openDocument = () => {
    const api = window.electronAPI;
    if (!api) {
      fileInput.current?.click();
      return;
    }
    return runOpen(
      () => api.selectDocument(),
      () => 'ممکن است فایل حذف شده باشد یا اجازهٔ خواندن آن را نداشته باشید.',
    );
  };

  const openBrowserFile = (file?: File) => {
    if (!file) return;
    return runOpen(
      () => readBrowserFile(file),
      (reason) => (reason instanceof Error ? reason.message : 'خواندن فایل ممکن نشد.'),
    );
  };

  const openSample = () => {
    acceptDocument({
      content: sample,
      documentId: 'sample',
      fileName: 'خوش‌آمدید.md',
      filePath: '',
    });
  };

  const closeWorkspaceTab = (tabId: string) => {
    ++latestRequest.current;
    if (tabId === workspace.activeTabId) {
      pendingRequests.current.clear();
      setLoading(false);
    }
    setWorkspace((current) => closeTab(current, tabId));
    setError('');
    setFocus(false);
    setDrawerOpen(false);
  };

  const closeDocument = () => {
    if (primaryTab) closeWorkspaceTab(primaryTab.tabId);
  };

  const activateWorkspaceTab = (tabId: string) => {
    setWorkspace((current) => activateTab(current, tabId));
    setDrawerOpen(false);
  };

  const toggleSplit = () => {
    if (narrow || workspace.tabs.length < 2) return;
    setWorkspace((current) =>
      setSplitTab(
        current,
        current.splitTabId
          ? null
          : (current.tabs.find((tab) => tab.tabId !== current.activeTabId)?.tabId ?? null),
      ),
    );
  };

  const updateScrollTop = (tabId: string, scrollTop: number) => {
    setWorkspace((current) => ({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.tabId === tabId && tab.scrollTop !== scrollTop ? { ...tab, scrollTop } : tab,
      ),
    }));
  };

  const showSidebar = hasHeadings && !narrow && sidebarVisible && !focus;

  return (
    <main
      className={`app-shell${focus ? ' focus-mode' : ''}`}
      dir="rtl"
      lang="fa"
      style={
        {
          '--reader-font-size': `${preferences.fontSize}px`,
          '--reader-line-height': preferences.lineHeight,
          '--reader-width': `${preferences.width}rem`,
        } as CSSProperties
      }
    >
      {!window.electronAPI ? (
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="انتخاب فایل متنی"
          accept={acceptedFiles}
          onChange={(event) => {
            void openBrowserFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      ) : null}
      {!focus ? (
        <Toolbar
          fileName={doc?.fileName}
          dark={theme === 'dark'}
          ebook={theme === 'ebook-reader'}
          hasHeadings={hasHeadings}
          sidebarOpen={narrow ? drawerOpen : showSidebar}
          sidebarId={outlineId}
          offlineLabel={offline.label}
          offlineReady={offline.ready}
          onInstall={offline.install}
          onClose={doc && !window.electronAPI ? closeDocument : undefined}
          onOpen={() => void openDocument()}
          onToggleTheme={() => changeTheme(theme === 'dark' ? 'light' : 'dark')}
          onToggleEbook={() =>
            changeTheme(
              theme === 'ebook-reader' ? (previousTheme.current ?? 'light') : 'ebook-reader',
            )
          }
          onToggleSidebar={() =>
            narrow ? setDrawerOpen((value) => !value) : setSidebarVisible((value) => !value)
          }
        />
      ) : (
        <div className="focus-header">
          <bdi>{doc?.fileName}</bdi>
          <button className="button" type="button" autoFocus onClick={exitFocus}>
            <Icon name="focus" />
            خروج از تمرکز
            <span className="key-hint" aria-hidden="true">
              Esc
            </span>
          </button>
        </div>
      )}
      {doc && !focus ? (
        <div ref={focusTrigger}>
          <ReadingToolbar
            preferences={preferences}
            restoreTabs={workspace.restoreTabs}
            onRestoreTabsChange={(restoreTabs) =>
              setWorkspace((current) => ({ ...current, restoreTabs }))
            }
            onChange={changePreferences}
            onReset={() => changePreferences(defaultPreferences)}
            onFocus={() => {
              setFocus(true);
              setDrawerOpen(false);
            }}
          />
        </div>
      ) : null}
      {workspace.tabs.length > 0 && !focus ? (
        <div className="workspace-tabs">
          <TabBar
            tabs={workspace.tabs}
            activeTabId={workspace.activeTabId}
            splitTabId={workspace.splitTabId}
            narrow={narrow || workspace.tabs.length < 2}
            onActivate={activateWorkspaceTab}
            onClose={closeWorkspaceTab}
            onToggleSplit={toggleSplit}
            onSelectSplit={(tabId) => setWorkspace((current) => setSplitTab(current, tabId))}
          />
          {!narrow && workspace.tabs.length < 2 ? (
            <button className="button button-quiet" type="button" disabled aria-pressed={false}>
              <Icon name="focus" />
              فعال کردن split
            </button>
          ) : null}
        </div>
      ) : null}
      {storageError ? (
        <p className="storage-notice" role="alert">
          ذخیرهٔ تب‌ها یا تنظیمات بازگردانی روی این دستگاه ممکن نشد. تغییرات این نشست ممکن است بعد
          از بستن صفحه حفظ نشوند.
        </p>
      ) : null}
      <div
        className={`workspace-panes${secondaryTab && !narrow ? ' is-split' : ''}`}
        style={{
          display: 'grid',
          flex: 1,
          minHeight: 0,
          gridTemplateColumns:
            secondaryTab && !narrow ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
        }}
      >
        <div className="document-pane" style={paneStyle}>
          <DocumentPane
            tab={primaryTab}
            paneId="primary"
            showSidebar={showSidebar}
            loading={loading}
            error={error}
            onNavigate={closeDrawer}
            onClose={closeDocument}
            onScrollTop={(value) => {
              if (primaryTab) updateScrollTop(primaryTab.tabId, value);
            }}
            outlineId={outlineId}
            narrow={narrow}
            drawerOpen={drawerOpen}
            onCloseDrawer={closeDrawer}
            onHeadingsChange={setHasHeadings}
            onOpen={() => void openDocument()}
            onOpenSample={openSample}
            onDropFile={(file) => void openBrowserFile(file)}
            offlineLabel={offline.label}
          />
        </div>
        {secondaryTab && !narrow ? (
          <div className="document-pane" style={paneStyle}>
            <DocumentPane
              tab={secondaryTab}
              paneId="secondary"
              showSidebar={sidebarVisible && !focus}
              loading={false}
              error=""
              onNavigate={closeDrawer}
              onClose={() => closeWorkspaceTab(secondaryTab.tabId)}
              onScrollTop={(value) => updateScrollTop(secondaryTab.tabId, value)}
              onDropFile={(file) => void openBrowserFile(file)}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
