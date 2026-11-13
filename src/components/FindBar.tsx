import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface FindBarProps {
  query: string;
  /** Zero-based index of the active match; -1 when there is no result yet. */
  activeIndex: number;
  count: number;
  /** Incremented when the user re-triggers the shortcut so the input refocuses. */
  focusSignal: number;
  onQueryChange(query: string): void;
  onNext(): void;
  onPrevious(): void;
  onClose(): void;
}

function formatCount(activeIndex: number, count: number, hasQuery: boolean): string {
  if (!hasQuery) return '';
  if (count === 0) return (0).toLocaleString('fa-IR');
  return `${(activeIndex + 1).toLocaleString('fa-IR')} از ${count.toLocaleString('fa-IR')}`;
}

export function FindBar({
  query,
  activeIndex,
  count,
  focusSignal,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [focusSignal]);

  return (
    <div className="find-bar" role="search" aria-label="جستجو در سند">
      <input
        ref={inputRef}
        className="find-input"
        type="search"
        dir="auto"
        value={query}
        placeholder="جستجو در سند…"
        aria-label="متن جستجو"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) onPrevious();
            else onNext();
          } else if (event.key === 'Escape') {
            // Keep the pane-level Escape handlers (focus mode, drawer) untouched.
            event.stopPropagation();
            onClose();
          }
        }}
      />
      <span className="find-count" role="status" aria-live="polite">
        {formatCount(activeIndex, count, Boolean(query.trim()))}
      </span>
      <button
        className="icon-button"
        type="button"
        aria-label="نتیجهٔ قبلی"
        title="نتیجهٔ قبلی (Shift+Enter)"
        disabled={count === 0}
        onClick={onPrevious}
      >
        <Icon name="chevron-up" />
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="نتیجهٔ بعدی"
        title="نتیجهٔ بعدی (Enter)"
        disabled={count === 0}
        onClick={onNext}
      >
        <Icon name="chevron-down" />
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="بستن جستجو"
        title="بستن جستجو (Esc)"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
    </div>
  );
}
