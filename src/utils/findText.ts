export interface TextMatch {
  start: number;
  end: number;
}

const markClass = 'find-hit';
const activeClass = 'is-active';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queryPattern(query: string): RegExp {
  return new RegExp(escapeRegExp(query), 'giu');
}

export function findQueryOffsets(text: string, query: string): TextMatch[] {
  const pattern = queryPattern(query);
  const matches: TextMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    // Zero-length matches only occur for empty queries, which callers reject.
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    matches.push({ start: match.index, end: match.index + match[0].length });
  }
  return matches;
}

export function markTextMatches(root: ParentNode, query: string): HTMLElement[] {
  clearTextMarks(root);
  if (!query.trim()) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(`mark.${markClass}`)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  const marks: HTMLElement[] = [];
  for (const node of nodes) {
    const matches = findQueryOffsets(node.data, query);
    if (matches.length === 0) continue;
    const parent = node.parentNode;
    if (!parent) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const { start, end } of matches) {
      if (start > cursor) fragment.append(document.createTextNode(node.data.slice(cursor, start)));
      const mark = document.createElement('mark');
      mark.className = markClass;
      mark.textContent = node.data.slice(start, end);
      fragment.append(mark);
      marks.push(mark);
      cursor = end;
    }
    if (cursor < node.data.length) {
      fragment.append(document.createTextNode(node.data.slice(cursor)));
    }
    parent.replaceChild(fragment, node);
  }
  return marks;
}

export function clearTextMarks(root: ParentNode): void {
  for (const mark of Array.from(root.querySelectorAll(`mark.${markClass}`))) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    if (parent instanceof Element) parent.normalize();
  }
}

export function activateMark(
  marks: readonly HTMLElement[],
  index: number,
  reducedMotion: boolean,
): void {
  marks.forEach((mark, position) => mark.classList.toggle(activeClass, position === index));
  const active = marks[index];
  // jsdom does not implement scrollIntoView; keep activation testable without a layout engine.
  active?.scrollIntoView?.({
    block: 'center',
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
}
