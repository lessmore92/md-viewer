import { Icon } from './Icon';
import type { WorkspaceTab } from '../app/workspace';

export interface TabBarProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  splitTabId: string | null;
  narrow: boolean;
  onActivate(tabId: string): void;
  onClose(tabId: string): void;
  onToggleSplit(): void;
  onSelectSplit(tabId: string): void;
}

export function TabBar({
  tabs,
  activeTabId,
  splitTabId,
  narrow,
  onActivate,
  onClose,
  onToggleSplit,
  onSelectSplit,
}: TabBarProps) {
  const splitEnabled = splitTabId !== null;

  return (
    <div className="tab-bar">
      <div role="tablist" aria-label="سندها" className="tab-bar-tabs">
        {tabs.map((tab) => {
          const active = tab.tabId === activeTabId;
          return (
            <div key={tab.tabId} className={`tab-bar-item${active ? ' is-active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`workspace-tab-panel-${tab.tabId}`}
                aria-label={tab.document.fileName}
                title={tab.document.fileName}
                tabIndex={active ? 0 : -1}
                onClick={() => onActivate(tab.tabId)}
                className="tab-bar-tab"
              >
                <bdi>{tab.document.fileName}</bdi>
              </button>
              <button
                type="button"
                className="tab-bar-close"
                aria-label={`بستن ${tab.document.fileName}`}
                title={`بستن ${tab.document.fileName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(tab.tabId);
                }}
              >
                <Icon name="close" width="14" height="14" />
              </button>
            </div>
          );
        })}
      </div>

      {!narrow ? (
        <div className="tab-bar-split">
          <button
            type="button"
            className="button button-quiet tab-bar-split-toggle"
            aria-pressed={splitEnabled}
            aria-label={splitEnabled ? 'بستن split' : 'فعال کردن split'}
            onClick={onToggleSplit}
          >
            <Icon name={splitEnabled ? 'close' : 'open'} />
            {splitEnabled ? 'بستن split' : 'فعال کردن split'}
          </button>

          {splitEnabled ? (
            <label className="tab-bar-split-select">
              <span>سند پنل دوم</span>
              <select
                aria-label="سند پنل دوم"
                value={splitTabId}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  if (next && next !== activeTabId) onSelectSplit(next);
                }}
              >
                {tabs.map((tab) => (
                  <option key={tab.tabId} value={tab.tabId} disabled={tab.tabId === activeTabId}>
                    {tab.document.fileName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
