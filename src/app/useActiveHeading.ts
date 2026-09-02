import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { HeadingItem } from '../markdown/headings';

function flattenIds(headings: HeadingItem[]): string[] {
  return headings.flatMap((heading) => [heading.id, ...flattenIds(heading.children)]);
}

export function useActiveHeading(
  headings: HeadingItem[],
  documentId: string | undefined,
  scrollRef: RefObject<HTMLElement>,
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const renderedHeadings = new Map(
      Array.from(root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]')).map((heading) => [
        heading.id,
        heading,
      ]),
    );
    const elements = flattenIds(headings)
      .map((id) => renderedHeadings.get(id))
      .filter((element): element is HTMLElement => element !== undefined);
    let frame: number | null = null;

    const update = () => {
      const readingLine = root.getBoundingClientRect().top + 24;
      let active = elements[0];
      for (const heading of elements) {
        if (heading.getBoundingClientRect().top > readingLine) break;
        active = heading;
      }
      // Short final sections cannot always reach the reading line.
      if (
        root.scrollHeight > root.clientHeight &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      ) {
        active = elements[elements.length - 1];
      }
      setActiveId(active?.id ?? null);
    };
    const schedule = () => {
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          update();
        });
      }
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(update, {
            root,
            rootMargin: '-24px 0px -70% 0px',
            threshold: [0, 1],
          });
    for (const heading of elements) observer?.observe(heading);
    // IO batches only contain changed targets. Geometry plus a passive scroll fallback
    // also covers fast jumps and upward scrolling through sections taller than the viewport.
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    root.addEventListener('load', schedule, true);
    update();
    return () => {
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root.removeEventListener('load', schedule, true);
    };
  }, [headings, documentId, scrollRef]);

  return [activeId, setActiveId] as const;
}
