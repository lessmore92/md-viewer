import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WorkspaceTab } from '../app/workspace';
import { useActiveHeading } from '../app/useActiveHeading';
import { extractHeadings } from '../markdown/headings';
import { MarkdownView } from '../markdown/MarkdownView';
import { scrollToHeading } from '../markdown/navigation';
import { detectDirection } from '../utils/direction';
import { activateMark, clearTextMarks, findQueryOffsets, markTextMatches } from '../utils/findText';
import type { TextMatch } from '../utils/findText';
import { FindBar } from './FindBar';
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
  findOpen?: boolean;
  /** Incremented each time the user triggers find so the bar refocuses. */
  findFocusSignal?: number;
  onFindClose?(): void;
  /** Presence of this prop marks the pane as editable. */
  onSave?(tabId: string, content: string): Promise<void>;
  onDirtyChange?(tabId: string, dirty: boolean): void;
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
  findOpen = false,
  findFocusSignal = 0,
  onFindClose,
  onSave,
  onDirtyChange,
}: (DocumentPaneProps | EmptyPaneProps) & AppPaneOptions) {
  const doc = tab?.document;
  const tabId = tab?.tabId;
  const content = doc?.content ?? '';
  const scrollRef = useRef<HTMLElement>(null);
  const generatedOutlineId = useId();
  const outlineId = providedOutlineId ?? generatedOutlineId;
  const [dragging, setDragging] = useState(false);

  // --- Editing ---------------------------------------------------------------
  const canEdit = Boolean(onSave);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Drafts survive tab switches because the pane instance outlives tab changes.
  const sessionsRef = useRef(new Map<string, { draft: string; editing: boolean }>());
  const draftRef = useRef('');
  draftRef.current = draft;

  // --- Find in page ----------------------------------------------------------
  const articleRef = useRef<HTMLElement>(null);
  const marksRef = useRef<HTMLElement[]>([]);
  const findSessionRef = useRef('');
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(-1);
  const [findCount, setFindCount] = useState(0);

  const headings = useMemo(() => extractHeadings(content), [content]);
  const displayed = editing ? draft : content;
  const words = useMemo(
    () => (displayed.trim() ? displayed.trim().split(/\s+/u).length : 0),
    [displayed],
  );
  const [activeId, setActiveId] = useActiveHeading(headings, doc?.documentId, scrollRef);
  const dirty = editing && draft !== content;
  const showSidebar = sidebarVisible && headings.length > 0 && !narrow && !editing;

  // Restore (or reset) the edit session when this pane starts showing another tab.
  useEffect(() => {
    const session = tabId ? sessionsRef.current.get(tabId) : undefined;
    setEditing(session?.editing ?? false);
    setDraft(session?.draft ?? '');
    setSaveError('');
  }, [tabId]);

  useEffect(() => {
    if (tabId) onDirtyChange?.(tabId, dirty);
  }, [tabId, dirty, onDirtyChange]);

  const startEditing = () => {
    if (!doc || !tab || !canEdit) return;
    const initial = sessionsRef.current.get(tab.tabId)?.draft ?? content;
    sessionsRef.current.set(tab.tabId, { draft: initial, editing: true });
    setDraft(initial);
    setEditing(true);
    setSaveError('');
  };

  const changeDraft = (value: string) => {
    if (!tab) return;
    sessionsRef.current.set(tab.tabId, { draft: value, editing: true });
    setDraft(value);
  };

  const stopEditing = () => {
    if (!tab) return;
    if (dirty && !window.confirm('تغییرات ذخیره‌نشده نادیده گرفته می‌شود. ادامه می‌دهید؟')) {
      return;
    }
    sessionsRef.current.delete(tab.tabId);
    setEditing(false);
    setDraft('');
    setSaveError('');
  };

  const saveEditing = useCallback(async () => {
    if (!tab || !onSave || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(tab.tabId, draftRef.current);
    } catch {
      setSaveError('ذخیره سند ممکن نشد. دوباره تلاش کنید.');
    } finally {
      setSaving(false);
    }
  }, [tab, onSave, saving]);

  const saveEditingRef = useRef(saveEditing);
  saveEditingRef.current = saveEditing;

  // Ctrl/Cmd+S saves while editing, even when focus is outside the textarea.
  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveEditingRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing]);

  const selectEditMatch = (index: number, matches: readonly TextMatch[]) => {
    const textarea = editorRef.current;
    const match = matches[index];
    if (!textarea || !match) return;
    textarea.focus();
    // Selecting text inside a focused textarea scrolls the caret into view.
    textarea.setSelectionRange(match.start, match.end);
  };

  // Rebuild highlights whenever the find session, direction or text changes. Typing
  // inside the editor only refreshes the count so the caret is not moved mid-edit.
  useEffect(() => {
    const root = articleRef.current;
    const active = findOpen && Boolean(findQuery.trim());
    const sessionKey = `${active ? 1 : 0}:${editing ? 1 : 0}:${doc?.documentId ?? ''}:${findQuery}`;
    const sessionChanged = findSessionRef.current !== sessionKey;
    findSessionRef.current = sessionKey;

    if (!active) {
      if (root) clearTextMarks(root);
      marksRef.current = [];
      setFindCount(0);
      setFindIndex(-1);
      return;
    }

    if (editing) {
      const matches = findQueryOffsets(draft, findQuery);
      setFindCount(matches.length);
      if (sessionChanged) {
        const index = matches.length ? 0 : -1;
        setFindIndex(index);
        if (index >= 0) selectEditMatch(index, matches);
      } else {
        setFindIndex((current) =>
          matches.length === 0 ? -1 : Math.min(Math.max(current, 0), matches.length - 1),
        );
      }
      return;
    }

    if (!root) {
      marksRef.current = [];
      setFindCount(0);
      setFindIndex(-1);
      return;
    }

    marksRef.current = markTextMatches(root, findQuery);
    setFindCount(marksRef.current.length);
    const index = marksRef.current.length ? 0 : -1;
    setFindIndex(index);
    if (index >= 0) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      activateMark(marksRef.current, index, reduced);
    }
    return () => {
      clearTextMarks(root);
      marksRef.current = [];
    };
  }, [findOpen, findQuery, editing, content, draft, doc?.documentId]);

  const goToMatch = (step: 1 | -1) => {
    if (!findOpen || !findQuery.trim()) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (editing) {
      const matches = findQueryOffsets(draftRef.current, findQuery);
      if (!matches.length) return;
      const base = findIndex < 0 ? (step > 0 ? -1 : 0) : findIndex;
      const next = (base + step + matches.length) % matches.length;
      setFindIndex(next);
      selectEditMatch(next, matches);
      return;
    }
    const marks = marksRef.current;
    if (!marks.length) return;
    const base = findIndex < 0 ? (step > 0 ? -1 : 0) : findIndex;
    const next = (base + step + marks.length) % marks.length;
    setFindIndex(next);
    activateMark(marks, next, reduced);
  };

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
      {findOpen && doc ? (
        <FindBar
          query={findQuery}
          activeIndex={findIndex}
          count={findCount}
          focusSignal={findFocusSignal}
          onQueryChange={setFindQuery}
          onNext={() => goToMatch(1)}
          onPrevious={() => goToMatch(-1)}
          onClose={() => onFindClose?.()}
        />
      ) : null}
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
              <div className={`document-sheet${editing ? ' is-editing' : ''}`}>
                <div className="document-heading">
                  <span>
                    <Icon name="book" />
                    <bdi>{doc.fileName}</bdi>
                  </span>
                  <span className="heading-actions">
                    {editing ? (
                      <>
                        {dirty ? <span className="dirty-label">تغییرات ذخیره‌نشده</span> : null}
                        {saveError ? (
                          <span className="save-error" role="alert">
                            {saveError}
                          </span>
                        ) : null}
                        <button
                          className="button button-compact"
                          type="button"
                          onClick={stopEditing}
                          disabled={saving}
                        >
                          انصراف
                        </button>
                        <button
                          className="button button-compact button-primary"
                          type="button"
                          onClick={() => void saveEditing()}
                          disabled={!dirty || saving}
                        >
                          {saving ? 'در حال ذخیره…' : 'ذخیره'}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="format-label">Markdown</span>
                        {canEdit ? (
                          <button
                            className="icon-button"
                            type="button"
                            onClick={startEditing}
                            aria-label="ویرایش سند"
                            title="ویرایش سند"
                          >
                            <Icon name="edit" />
                          </button>
                        ) : null}
                      </>
                    )}
                  </span>
                </div>
                {editing ? (
                  <div className="editing-workspace">
                    <textarea
                      ref={editorRef}
                      className="markdown-editor"
                      dir={detectDirection(draft)}
                      value={draft}
                      aria-label={`ویرایش ${doc.fileName}`}
                      spellCheck={false}
                      onChange={(event) => changeDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          event.preventDefault();
                          const field = event.currentTarget;
                          const { selectionStart, selectionEnd, value } = field;
                          const next = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
                          changeDraft(next);
                          requestAnimationFrame(() => {
                            field.setSelectionRange(selectionStart + 1, selectionStart + 1);
                          });
                        }
                      }}
                    />
                    <section
                      className="markdown-preview"
                      aria-label="پیش‌نمایش زنده"
                      dir={detectDirection(draft)}
                    >
                      <div className="markdown-body">
                        <MarkdownView content={draft} documentId={doc.documentId} onNavigate={navigate} />
                      </div>
                    </section>
                  </div>
                ) : content.trim() ? (
                  <article
                    ref={articleRef}
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
                )}
              </div>
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
      {narrow && headings.length > 0 && !editing ? (
        <SidebarDrawer open={drawerOpen} onClose={() => onCloseDrawer?.()}>
          <div className="drawer-outline" id={outlineId}>
            <TableOfContents headings={headings} activeId={activeId} onNavigate={navigate} />
          </div>
        </SidebarDrawer>
      ) : null}
    </>
  );
}
