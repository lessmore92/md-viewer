import { Icon } from './Icon';

interface ToolbarProps {
  fileName?: string;
  dark: boolean;
  ebook: boolean;
  hasHeadings: boolean;
  sidebarOpen: boolean;
  sidebarId: string;
  offlineLabel: string;
  offlineReady: boolean;
  onInstall?: () => Promise<void>;
  onClose?: () => void;
  onOpen: () => void;
  onToggleTheme: () => void;
  onToggleEbook: () => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  fileName,
  dark,
  ebook,
  hasHeadings,
  sidebarOpen,
  sidebarId,
  offlineLabel,
  offlineReady,
  onInstall,
  onClose,
  onOpen,
  onToggleTheme,
  onToggleEbook,
  onToggleSidebar,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-document">
        <img
          className="toolbar-logo"
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          width="38"
          height="38"
        />
        <div className="brand-copy">
          <span className="toolbar-brand" dir="ltr">
            MD Viewer
          </span>
          <span className="brand-caption">فضایی برای خواندن</span>
        </div>
        {fileName ? (
          <div className="document-name">
            <bdi className="toolbar-filename" title={fileName}>
              {fileName}
            </bdi>
            {onClose ? (
              <button
                className="icon-button"
                type="button"
                onClick={onClose}
                aria-label="بستن و پاک کردن سند ذخیره‌شده"
                title="بستن و پاک کردن سند ذخیره‌شده"
              >
                <Icon name="close" width="14" height="14" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="toolbar-actions">
        <span className={`offline-badge${offlineReady ? ' is-ready' : ''}`}>
          <span aria-hidden="true" />
          {offlineLabel}
        </span>
        {onInstall ? (
          <button
            className="button button-quiet install-button"
            onClick={() => void onInstall()}
            type="button"
          >
            <Icon name="download" />
            نصب برنامه
          </button>
        ) : null}
        <button className="button button-primary" onClick={onOpen} type="button">
          <Icon name="open" />
          باز کردن فایل
        </button>
        {hasHeadings ? (
          <button
            className="icon-button outline-toggle"
            aria-label={sidebarOpen ? 'پنهان کردن فهرست مطالب' : 'نمایش فهرست مطالب'}
            title="فهرست مطالب"
            aria-expanded={sidebarOpen}
            aria-controls={sidebarOpen ? sidebarId : undefined}
            onClick={onToggleSidebar}
            type="button"
          >
            <Icon name="outline" />
          </button>
        ) : null}
        <button
          className="button button-quiet ebook-toggle"
          aria-label="حالت کتابخوان"
          aria-pressed={ebook}
          title={ebook ? 'بازگشت به ظاهر قبلی' : 'حالت کتابخوان (E-Ink)'}
          onClick={onToggleEbook}
          type="button"
        >
          <Icon name="book" />
          کتابخوان
        </button>
        <button
          className="icon-button theme-toggle"
          aria-label={dark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تیره'}
          title={dark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تیره'}
          onClick={onToggleTheme}
          type="button"
        >
          <Icon name={dark ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}
