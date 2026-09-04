import { useRef, type ChangeEvent } from 'react';
import type { WorkspaceTab } from '../app/workspace';
import { Icon } from './Icon';

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
  const tabStripRef = useRef<HTMLDivElement>(null);
  const splitEnabled = splitTabId !== null;

  const handleSplitSelection = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextTabId = event.target.value;
    if (!nextTabId || nextTabId === activeTabId) return;
    if (!tabs.some((tab) => tab.tabId === nextTabId)) return;
    onSelectSplit(nextTabId);
  };

  return (
    <section className="tab-bar" aria-label="نوار سندها">
      <div
        ref={tabStripRef}
        className="tab-strip"
        role="tablist"
        aria-label="سندهای باز"
        tabIndex={-1}
      >
        {tabs.map((tab, index) => {
          const selected = tab.tabId === activeTabId;
          const fileName = tab.document.fileName;

          return (
            <div key={tab.tabId} className="tab-chip">
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className={`tab-button${selected ? ' is-active' : ''}`}
                title={fileName}
                onClick={() => onActivate(tab.tabId)}
              >
                <bdi>{fileName}</bdi>
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`بستن ${fileName}`}
                title={`بستن ${fileName}`}
                onClick={(event) => {
                  event.stopPropagation();
                  const buttons =
                    tabStripRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  // Move focus before React removes the close button; keyed tabs retain it.
                  const nextFocus =
                    buttons?.[index + 1] ?? buttons?.[index - 1] ?? tabStripRef.current;
                  nextFocus?.focus();
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
        <div className="tab-bar-actions">
          <button
            type="button"
            className="button button-quiet"
            aria-pressed={splitEnabled}
            onClick={onToggleSplit}
          >
            <Icon name="focus" />
            {splitEnabled ? 'بستن split' : 'فعال کردن split'}
          </button>

          {splitEnabled ? (
            <label>
              <span>سند پنل دوم</span>
              <select value={splitTabId ?? ''} onChange={handleSplitSelection}>
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
    </section>
  );
}
