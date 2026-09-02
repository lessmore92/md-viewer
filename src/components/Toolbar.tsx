interface ToolbarProps {
  fileName?: string;
  dark: boolean;
  hasHeadings: boolean;
  sidebarOpen: boolean;
  sidebarId: string;
  onOpen: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  fileName,
  dark,
  hasHeadings,
  sidebarOpen,
  sidebarId,
  onOpen,
  onToggleTheme,
  onToggleSidebar,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-document">
        <span className="toolbar-brand" dir="ltr">
          MD
        </span>
        <bdi className="toolbar-filename" title={fileName}>
          {fileName || 'MD Viewer'}
        </bdi>
      </div>
      <div className="toolbar-actions">
        <button className="button button-primary" onClick={onOpen} type="button">
          باز کردن فایل
        </button>
        {hasHeadings ? (
          <button
            className="button"
            aria-label={sidebarOpen ? 'پنهان کردن فهرست مطالب' : 'نمایش فهرست مطالب'}
            aria-expanded={sidebarOpen}
            aria-controls={sidebarOpen ? sidebarId : undefined}
            onClick={onToggleSidebar}
            type="button"
          >
            فهرست مطالب
          </button>
        ) : null}
        <button
          className="button theme-toggle"
          aria-label={dark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تیره'}
          title={dark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تیره'}
          onClick={onToggleTheme}
          type="button"
        >
          <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
        </button>
      </div>
    </header>
  );
}
