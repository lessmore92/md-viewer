import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WorkspaceTab } from '../app/workspace';
import { useActiveHeading } from '../app/useActiveHeading';
import { extractHeadings } from '../markdown/headings';
import { MarkdownView } from '../markdown/MarkdownView';
import { scrollToHeading } from '../markdown/navigation';
import { detectDirection } from '../utils/direction';
import { Icon } from './Icon';
import { ReadingStatus } from './ReadingStatus';
import { SidebarDrawer } from './SidebarDrawer';
import { TableOfContents } from './TableOfContents';

export type PaneId = 'primary' | 'secondary';

export interface DocumentPaneProps {
  tab: WorkspaceTab;
  paneId: PaneId;
  showSidebar: boolean;
  loading: boolean;
  error: string;
  onNavigate(id: string, pane: PaneId): void;
  onClose(): void;
  onScrollTop(value: number): void;
}

// The single-document shell also uses the pane before a document is opened.
interface AppPaneOptions {
  outlineId?: string;
  narrow?: boolean;
  drawerOpen?: boolean;
  onCloseDrawer?(): void;
  onHeadingsChange?(hasHeadings: boolean): void;
  onOpen?(): void;
  onOpenSample?(): void;
  onDropFile?(file?: File): void;
  storageError?: boolean;
  offlineLabel?: string;
}

type EmptyPaneProps = Omit<DocumentPaneProps, 'tab'> & { tab: null };

export function DocumentPane({
  tab,
  paneId,
  showSidebar: sidebarVisible,
  loading,
  error,
  onNavigate,
  onScrollTop,
  outlineId: providedOutlineId,
  narrow = false,
  drawerOpen = false,
  onCloseDrawer,
  onHeadingsChange,
  onOpen,
  onOpenSample,
  onDropFile,
  storageError = false,
  offlineLabel = '',
}: (DocumentPaneProps | EmptyPaneProps) & AppPaneOptions) {
  const doc = tab?.document;
  const content = doc?.content ?? '';
  const scrollRef = useRef<HTMLElement>(null);
  const generatedOutlineId = useId();
  const outlineId = providedOutlineId ?? generatedOutlineId;
  const [dragging, setDragging] = useState(false);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const words = useMemo(
    () => (content.trim() ? content.trim().split(/\s+/u).length : 0),
    [content],
  );
  const [activeId, setActiveId] = useActiveHeading(headings, doc?.documentId, scrollRef);
  const showSidebar = sidebarVisible && headings.length > 0 && !narrow;

  useEffect(() => {
    onHeadingsChange?.(headings.length > 0);
  }, [headings, onHeadingsChange]);

  const savedScrollTop = tab?.scrollTop ?? 0;
  const lastReportedScroll = useRef<{
    tabId: string | undefined;
    document: typeof doc;
    scrollTop: number;
  } | null>(null);
  useEffect(() => {
    const reported = lastReportedScroll.current;
    // Parent state echoes normal scrolling; only external restoration needs a DOM write.
    if (
      reported?.tabId === tab?.tabId &&
      reported?.document === doc &&
      reported?.scrollTop === savedScrollTop
    ) {
      return;
    }
    lastReportedScroll.current = null;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop;
    });
    return () => cancelAnimationFrame(frame);
  }, [tab?.tabId, doc, savedScrollTop]);

  const navigate = useCallback(
    (id: string) => {
      if (scrollRef.current) scrollToHeading(id, scrollRef.current);
      setActiveId(id);
      onNavigate(id, paneId);
      onCloseDrawer?.();
    },
    [setActiveId, onNavigate, paneId, onCloseDrawer],
  );

  return (
    <>
      <section
        className={`reader-scroll${dragging ? ' is-dragging' : ''}`}
        ref={scrollRef}
        aria-label="محتوای سند"
        tabIndex={-1}
        onScroll={() => {
          const scrollTop = scrollRef.current?.scrollTop ?? 0;
          lastReportedScroll.current = { tabId: tab?.tabId, document: doc, scrollTop };
          onScrollTop(scrollTop);
        }}
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
          if (!window.electronAPI) onDropFile?.(event.dataTransfer.files[0]);
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
                <button className="button" onClick={() => onOpen?.()} type="button">
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
                    onClick={() => onOpen?.()}
                  >
                    <Icon name="open" />
                    انتخاب سند
                  </button>
                  <button className="button" type="button" onClick={onOpenSample}>
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
      </section>
      {doc ? (
        <ReadingStatus scrollRef={scrollRef} documentId={doc.documentId} words={words} />
      ) : (
        <footer className="welcome-footer">
          <span>با حوصله بخوانید.</span>
          <span>{offlineLabel}</span>
        </footer>
      )}
      {narrow && headings.length > 0 ? (
        <SidebarDrawer open={drawerOpen} onClose={() => onCloseDrawer?.()}>
          <div className="drawer-outline" id={outlineId}>
            <TableOfContents headings={headings} activeId={activeId} onNavigate={navigate} />
          </div>
        </SidebarDrawer>
      ) : null}
    </>
  );
}
