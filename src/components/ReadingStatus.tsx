import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Icon } from './Icon';

interface Props {
  scrollRef: RefObject<HTMLElement>;
  documentId: string;
  words: number;
}

export function ReadingStatus({ scrollRef, documentId, words }: Props) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const update = () => {
      const distance = root.scrollHeight - root.clientHeight;
      setProgress(
        distance > 0
          ? Math.min(100, Math.max(0, Math.round((root.scrollTop / distance) * 100)))
          : 100,
      );
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(root);
    if (root.firstElementChild) observer?.observe(root.firstElementChild);
    root.addEventListener('scroll', update, { passive: true });
    root.addEventListener('load', update, true);
    update();
    return () => {
      observer?.disconnect();
      root.removeEventListener('scroll', update);
      root.removeEventListener('load', update, true);
    };
  }, [scrollRef, documentId]);
  const minutes = Math.max(1, Math.ceil(words / 200));
  return (
    <footer className="reading-status">
      <div className="reading-stats">
        <span>
          <Icon name="clock" />
          حدود {minutes.toLocaleString('fa-IR')} دقیقه مطالعه
        </span>
        <span>{words.toLocaleString('fa-IR')} واژه</span>
      </div>
      <div className="reading-progress">
        <progress aria-label="پیشرفت مطالعه" value={progress} max="100" />
        <span>{progress.toLocaleString('fa-IR')}٪</span>
        <button
          className="icon-button"
          type="button"
          aria-label="رفتن به ابتدای سند"
          title="رفتن به ابتدای سند"
          onClick={() =>
            scrollRef.current?.scrollTo({
              top: 0,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth',
            })
          }
        >
          <Icon name="arrow" />
        </button>
      </div>
    </footer>
  );
}
