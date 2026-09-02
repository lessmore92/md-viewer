import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DocumentPayload } from '../../electron/contracts';
import { SidebarDrawer } from '../components/SidebarDrawer';
import { TableOfContents } from '../components/TableOfContents';
import { Toolbar } from '../components/Toolbar';
import { extractHeadings } from '../markdown/headings';
import { MarkdownView } from '../markdown/MarkdownView';
import { scrollToHeading } from '../markdown/navigation';
import { detectDirection } from '../utils/direction';
import { applyTheme, readDarkPreference } from './theme';
import { useActiveHeading } from './useActiveHeading';

const narrowQuery = '(max-width: 960px)';

export default function App() {
  const [doc, setDoc] = useState<DocumentPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [dark, setDark] = useState(readDarkPreference);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(narrowQuery).matches ?? false);
  const latestRequest = useRef(0);
  const outlineId = useId();
  const scrollRef = useRef<HTMLElement>(null);
  const content = doc?.content ?? '';
  const headings = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useActiveHeading(headings, doc?.documentId, scrollRef);

  const acceptDocument = useCallback((next: DocumentPayload) => {
    setDoc(next);
    setError(false);
    setLoading(false);
    setDrawerOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

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
    applyTheme(dark);
    try {
      localStorage.setItem('md-viewer-dark', String(dark));
    } catch {
      /* Storage is optional. */
    }
  }, [dark]);

  const openDocument = async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(false);
    try {
      const next = await window.electronAPI.selectDocument();
      if (request !== latestRequest.current) return;
      if (next) acceptDocument(next);
    } catch {
      if (request === latestRequest.current) setError(true);
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  const navigate = useCallback(
    (id: string) => {
      scrollToHeading(id, scrollRef.current ?? document);
      setActiveId(id);
      setDrawerOpen(false);
    },
    [setActiveId],
  );
  const showSidebar = headings.length > 0 && !narrow && sidebarVisible;

  return (
    <div className="app-shell" dir="rtl" lang="fa">
      <Toolbar
        fileName={doc?.fileName}
        dark={dark}
        hasHeadings={headings.length > 0}
        sidebarOpen={narrow ? drawerOpen : showSidebar}
        sidebarId={outlineId}
        onOpen={() => void openDocument()}
        onToggleTheme={() => setDark((value) => !value)}
        onToggleSidebar={() =>
          narrow ? setDrawerOpen((value) => !value) : setSidebarVisible((value) => !value)
        }
      />
      <main className="reader-scroll" ref={scrollRef} aria-label="محتوای سند" tabIndex={-1}>
        <div className={`reader-layout${showSidebar ? ' with-sidebar' : ''}`}>
          <div className="document-column">
            {loading ? (
              <p className="loading-status" role="status">
                در حال باز کردن فایل…
              </p>
            ) : null}
            {error ? (
              <section className="document-error" role="alert">
                <h1>باز کردن فایل ممکن نشد</h1>
                <p>ممکن است فایل حذف شده باشد یا اجازهٔ خواندن آن را نداشته باشید.</p>
                <button className="button" onClick={() => void openDocument()} type="button">
                  انتخاب فایل دیگر
                </button>
              </section>
            ) : null}
            {doc ? (
              content.trim() ? (
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
              ) : (
                <p className="empty-document">این فایل خالی است.</p>
              )
            ) : !error ? (
              <section className="empty-state">
                <span className="empty-file-mark" aria-hidden="true" dir="ltr">
                  .md
                </span>
                <h1>فایل Markdown خود را باز کنید</h1>
                <p>
                  برای شروع، «باز کردن فایل» را انتخاب کنید. متن، کد و تصاویر سند اینجا نمایش داده
                  می‌شوند.
                </p>
                <p className="supported-formats" dir="ltr">
                  .md · .markdown · .mdown · .mkd
                </p>
              </section>
            ) : null}
          </div>
          {showSidebar ? (
            <aside className="desktop-sidebar" id={outlineId}>
              <h2>فهرست مطالب</h2>
              <TableOfContents headings={headings} activeId={activeId} onNavigate={navigate} />
            </aside>
          ) : null}
        </div>
      </main>
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
