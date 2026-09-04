import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DocumentPayload } from '../../electron/contracts';
import { SidebarDrawer } from '../components/SidebarDrawer';
import { TableOfContents } from '../components/TableOfContents';
import { Toolbar } from '../components/Toolbar';
import { ReadingToolbar } from '../components/ReadingToolbar';
import { ReadingStatus } from '../components/ReadingStatus';
import { Icon } from '../components/Icon';
import { extractHeadings } from '../markdown/headings';
import { MarkdownView } from '../markdown/MarkdownView';
import { scrollToHeading } from '../markdown/navigation';
import { detectDirection } from '../utils/direction';
import { applyTheme, readTheme, readStandardTheme, saveTheme } from './theme';
import type { Theme, StandardTheme } from './theme';
import { useActiveHeading } from './useActiveHeading';
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
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const focusTrigger = useRef<HTMLDivElement>(null);
  const offline = useOffline();
  const [theme, setTheme] = useState(readTheme);
  const previousTheme = useRef<StandardTheme | null>(null);
  if (previousTheme.current === null)
    previousTheme.current = theme === 'ebook-reader' ? readStandardTheme() : theme;
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(narrowQuery).matches ?? false);
  const latestRequest = useRef(0);
  const outlineId = useId();
  const scrollRef = useRef<HTMLElement>(null);
  const content = doc?.content ?? '';
  const words = useMemo(
    () => (content.trim() ? content.trim().split(/\s+/u).length : 0),
    [content],
  );
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useActiveHeading(headings, doc?.documentId, scrollRef);

  const acceptDocument = useCallback((next: DocumentPayload) => {
    setDoc(next);
    setError('');
    if (!window.electronAPI) setStorageError(!saveBrowserDocument(next));
    setLoading(false);
    setDrawerOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
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

  const navigate = useCallback(
    (id: string) => {
      scrollToHeading(id, scrollRef.current ?? document);
      setActiveId(id);
      setDrawerOpen(false);
    },
    [setActiveId],
  );
  const showSidebar = headings.length > 0 && !narrow && sidebarVisible && !focus;

  return (
    <div
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
          hasHeadings={headings.length > 0}
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
      <main
        className={`reader-scroll${dragging ? ' is-dragging' : ''}`}
        ref={scrollRef}
        aria-label="محتوای سند"
        tabIndex={-1}
        onDragOver={(event) => {
          if (!window.electronAPI && event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!window.electronAPI) void openBrowserFile(event.dataTransfer.files[0]);
        }}
      >
        <div className={`reader-layout${showSidebar ? ' with-sidebar' : ''}`}>
          <div className="document-column">
            {storageError ? (
              <p className="storage-notice" role="alert">
                مرورگر اجازهٔ ذخیره یا پاک کردن سند را نداد. تغییرات این نشست ممکن است بعد از بستن
                صفحه حفظ نشوند.
              </p>
            ) : null}
            {loading ? (
              <p className="loading-status" role="status">
                در حال باز کردن فایل…
              </p>
            ) : null}
            {error ? (
              <section className="document-error" role="alert">
                <h1>باز کردن فایل ممکن نشد</h1>
                <p>{error}</p>
                <button className="button" onClick={() => void openDocument()} type="button">
                  انتخاب فایل دیگر
                </button>
              </section>
            ) : null}
            {doc ? (
              content.trim() ? (
                <div className="document-sheet">
                  <div className="document-heading">
                    <span>
                      <Icon name="book" />
                      <bdi>{doc.fileName}</bdi>
                    </span>
                    <span>Markdown</span>
                  </div>
                  <article
                    className="markdown-body"
                    dir={detectDirection(content)}
                    aria-label={doc.fileName}
                  >
                    <MarkdownView
                      key={doc.documentId}
                      content={content}
                      documentId={doc.documentId}
                      onNavigate={navigate}
                    />
                  </article>
                </div>
              ) : (
                <p className="empty-document">این فایل خالی است.</p>
              )
            ) : !error ? (
              <section className="empty-state">
                <img
                  className="empty-logo"
                  src={`${import.meta.env.BASE_URL}icon.svg`}
                  width="88"
                  height="88"
                  alt=""
                />
                <h1>فایل Markdown خود را باز کنید</h1>
                <p>
                  یادداشت‌ها، ایده‌ها و مستندات‌تان؛ در فضایی آرام و خوانا. یک فایل انتخاب کنید
                  {!window.electronAPI ? ' یا همین‌جا رها کنید' : ''}.
                </p>
                <div className="empty-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void openDocument()}
                  >
                    <Icon name="open" />
                    انتخاب سند
                  </button>
                  <button className="button" type="button" onClick={openSample}>
                    <Icon name="book" />
                    مشاهدهٔ نمونه
                  </button>
                </div>
                <p className="supported-formats" dir="ltr">
                  .md · .markdown · .mdown · .mkd{!window.electronAPI ? ' · .txt' : ''}
                </p>
                <div className="empty-notes">
                  <span>
                    <Icon name="check" />
                    فارسی و انگلیسی، کنار هم
                  </span>
                  <span>
                    <Icon name="check" />
                    مطالعه با تنظیمات دلخواه
                  </span>
                </div>
                <p className="privacy-note">فایل انتخابی شما روی همین دستگاه خوانده می‌شود.</p>
              </section>
            ) : null}
          </div>
          {showSidebar ? (
            <aside className="desktop-sidebar" id={outlineId}>
              <div className="outline-heading">
                <h2>در این سند</h2>
                <Icon name="outline" />
              </div>
              <TableOfContents headings={headings} activeId={activeId} onNavigate={navigate} />
              <p className="outline-hint">برای جابه‌جایی، یک عنوان را انتخاب کنید.</p>
            </aside>
          ) : null}
        </div>
      </main>
      {doc ? (
        <ReadingStatus scrollRef={scrollRef} documentId={doc.documentId} words={words} />
      ) : (
        <footer className="welcome-footer">
          <span>با حوصله بخوانید.</span>
          <span>{offline.label}</span>
        </footer>
      )}
      {narrow && headings.length > 0 ? (
        <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <div className="drawer-outline" id={outlineId}>
            <TableOfContents headings={headings} activeId={activeId} onNavigate={navigate} />
          </div>
        </SidebarDrawer>
      ) : null}
    </div>
  );
}
