import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DocumentPayload } from '../../electron/contracts';
import { DocumentPane } from '../components/DocumentPane';
import type { WorkspaceTab } from './workspace';
import { Toolbar } from '../components/Toolbar';
import { ReadingToolbar } from '../components/ReadingToolbar';
import { Icon } from '../components/Icon';
import { applyTheme, readTheme, readStandardTheme, saveTheme } from './theme';
import type { Theme, StandardTheme } from './theme';
import {
  acceptedFiles,
  readBrowserFile,
  restoreBrowserDocument,
  saveBrowserDocument,
} from './browserDocument';
import { defaultPreferences, readPreferences, savePreferences } from './readingPreferences';
import type { ReadingPreferences } from './readingPreferences';
import { useOffline } from './useOffline';
import sample from './sample.md?raw';

const narrowQuery = '(max-width: 960px)';

export default function App() {
  const [doc, setDoc] = useState<DocumentPayload | null>(() =>
    window.electronAPI ? null : restoreBrowserDocument(),
  );
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
  const outlineId = useId();
  const [hasHeadings, setHasHeadings] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const tab = useMemo<WorkspaceTab | null>(
    () =>
      doc
        ? {
            tabId: doc.documentId,
            document: doc,
            documentKey: doc.documentId,
            scrollTop,
          }
        : null,
    [doc, scrollTop],
  );

  const acceptDocument = useCallback((next: DocumentPayload) => {
    setDoc(next);
    setError('');
    if (!window.electronAPI) setStorageError(!saveBrowserDocument(next));
    setLoading(false);
    setDrawerOpen(false);
    setScrollTop(0);
  }, []);

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
    const invalidateRequests = () => {
      ++latestRequest.current;
    };
    const unsubscribe = window.electronAPI?.onDocumentOpened((next) => {
      invalidateRequests();
      acceptDocument(next);
    });
    return () => {
      invalidateRequests();
      unsubscribe?.();
    };
  }, [acceptDocument]);

  useEffect(() => {
    const media = window.matchMedia?.(narrowQuery);
    if (!media) return;
    const update = () => {
      setNarrow(media.matches);
      setDrawerOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const openDocument = async () => {
    if (!window.electronAPI) {
      fileInput.current?.click();
      return;
    }
    const request = ++latestRequest.current;
    setLoading(true);
    setError('');
    try {
      const next = await window.electronAPI.selectDocument();
      if (request !== latestRequest.current) return;
      if (next) acceptDocument(next);
    } catch {
      if (request === latestRequest.current)
        setError('ممکن است فایل حذف شده باشد یا اجازهٔ خواندن آن را نداشته باشید.');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  const openBrowserFile = async (file?: File) => {
    if (!file) return;
    const request = ++latestRequest.current;
    setLoading(true);
    setError('');
    try {
      const next = await readBrowserFile(file);
      if (request === latestRequest.current) acceptDocument(next);
    } catch (reason) {
      if (request === latestRequest.current)
        setError(reason instanceof Error ? reason.message : 'خواندن فایل ممکن نشد.');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  const openSample = () => {
    ++latestRequest.current;
    acceptDocument({
      content: sample,
      documentId: 'sample',
      fileName: 'خوش‌آمدید.md',
      filePath: '',
    });
  };

  const closeDocument = () => {
    ++latestRequest.current;
    setDoc(null);
    setError('');
    setLoading(false);
    setFocus(false);
    setDrawerOpen(false);
    setStorageError(!saveBrowserDocument(null));
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
            onChange={changePreferences}
            onReset={() => changePreferences(defaultPreferences)}
            onFocus={() => {
              setFocus(true);
              setDrawerOpen(false);
            }}
          />
        </div>
      ) : null}
      <DocumentPane
        tab={tab}
        paneId="primary"
        showSidebar={showSidebar}
        loading={loading}
        error={error}
        onNavigate={closeDrawer}
        onClose={closeDocument}
        onScrollTop={setScrollTop}
        outlineId={outlineId}
        narrow={narrow}
        drawerOpen={drawerOpen}
        onCloseDrawer={closeDrawer}
        onHeadingsChange={setHasHeadings}
        onOpen={() => void openDocument()}
        onOpenSample={openSample}
        onDropFile={(file) => void openBrowserFile(file)}
        storageError={storageError}
        offlineLabel={offline.label}
      />
    </main>
  );
}
