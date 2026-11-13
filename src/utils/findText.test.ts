import { describe, expect, it, vi } from 'vitest';
import { activateMark, clearTextMarks, findQueryOffsets, markTextMatches } from './findText';

describe('findQueryOffsets', () => {
  it('finds every case-insensitive match with original-text offsets', () => {
    expect(findQueryOffsets('Hello hELLo hello', 'hello')).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
      { start: 12, end: 17 },
    ]);
  });

  it('matches Persian text literally', () => {
    const matches = findQueryOffsets('سلام دنیا، سلام', 'سلام');
    expect(matches).toEqual([
      { start: 0, end: 4 },
      { start: 11, end: 15 },
    ]);
  });

  it('returns no matches for an empty or absent query', () => {
    expect(findQueryOffsets('abc', '')).toEqual([]);
    expect(findQueryOffsets('abc', 'xyz')).toEqual([]);
  });

  it('treats query characters literally instead of as a pattern', () => {
    expect(findQueryOffsets('a.c abc', 'a.c')).toEqual([{ start: 0, end: 3 }]);
  });
});

describe('markTextMatches / clearTextMarks', () => {
  it('wraps matches in mark elements across nested elements', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>Hello <strong>big Hello</strong> world</p>';

    const marks = markTextMatches(root, 'hello');

    expect(marks).toHaveLength(2);
    expect(root.querySelectorAll('mark.find-hit')).toHaveLength(2);
    expect(root.textContent).toBe('Hello big Hello world');
    expect(marks[0]).toHaveClass('find-hit');
    expect(marks[0]).not.toHaveClass('is-active');
  });

  it('restores the original DOM text when cleared', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>Hello <em>Hello</em></p>';
    const paragraph = root.querySelector('p')!;

    markTextMatches(root, 'hello');
    clearTextMarks(root);

    expect(root.querySelectorAll('mark.find-hit')).toHaveLength(0);
    expect(root.innerHTML).toBe('<p>Hello <em>Hello</em></p>');
    expect(paragraph.childNodes).toHaveLength(2);
    expect(paragraph.childNodes[0].textContent).toBe('Hello ');
  });

  it('marks nothing for a blank query', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>Hello</p>';
    expect(markTextMatches(root, '   ')).toHaveLength(0);
    expect(root.querySelectorAll('mark')).toHaveLength(0);
  });

  it('replaces a previous highlight pass instead of double-marking', () => {
    const root = document.createElement('article');
    root.innerHTML = '<p>Hello hello</p>';

    markTextMatches(root, 'hello');
    const second = markTextMatches(root, 'hell');

    expect(second).toHaveLength(2);
    expect(root.querySelectorAll('mark')).toHaveLength(2);
  });
});

describe('activateMark', () => {
  it('flags only the requested mark and scrolls it into view', () => {
    const marks = [document.createElement('mark'), document.createElement('mark')];
    const scroll = vi.fn();
    Object.defineProperty(marks[1], 'scrollIntoView', { value: scroll, configurable: true });
    marks[0].classList.add('is-active');

    activateMark(marks, 1, false);

    expect(marks[0]).not.toHaveClass('is-active');
    expect(marks[1]).toHaveClass('is-active');
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });
});
