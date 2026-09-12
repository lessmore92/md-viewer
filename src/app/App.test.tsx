import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import { installDialog, installMedia } from '../test/browser';
import App from './App';
import { restoreTabsStorageKey, workspaceStorageKey } from './workspace';

function payload(
  name: string,
  content = `# ${name}\n\n## Install\n\n### Windows`,
): DocumentPayload {
  return { fileName: `${name}.md`, filePath: `C:\\docs\\${name}.md`, documentId: name, content };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function installApi() {
  const listeners = new Set<(document: DocumentPayload) => void>();
  const unsubscribes: ReturnType<typeof vi.fn>[] = [];
  const selectDocument = vi.fn<() => Promise<DocumentPayload | null>>(async () => null);
  window.electronAPI = {
    copyText: vi.fn(async () => true),
    selectDocument,
    openExternal: vi.fn(async () => true),
    assetUrl: (id, path) => `md-asset://local/${id}/${path}`,
    onDocumentOpened: vi.fn((callback) => {
      listeners.add(callback);
      const unsubscribe = vi.fn(() => listeners.delete(callback));
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    }),
  };
  return {
    selectDocument,
    unsubscribes,
    opened: (doc: DocumentPayload) =>
      act(() => {
        for (const listener of listeners) listener(doc);
      }),
  };
}

let observers: {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[];
beforeEach(() => {
  localStorage.clear();
  installMedia();
  installDialog();
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(public callback: IntersectionObserverCallback) {
        observers.push(this);
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('provides Persian empty state and accessible toolbar controls', () => {
  installApi();
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'فایل Markdown خود را باز کنید' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'باز کردن فایل' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'فعال کردن حالت تیره' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /فهرست مطالب/ })).not.toBeInTheDocument();
});

it('places document tabs in the header and hides platform-only labels', () => {
  const api = installApi();
  const { container } = render(<App />);
  api.opened(payload('First'));
  api.opened(payload('Second'));

  const header = screen.getByRole('banner');
  expect(within(header).getByRole('tablist', { name: 'سندهای باز' })).toBeInTheDocument();
  expect(header.querySelector('.toolbar-workspace > .tab-bar')).toBeInTheDocument();
  expect(container.querySelector('.workspace-tabs')).not.toBeInTheDocument();
  expect(screen.queryByText('نسخهٔ دسکتاپ')).not.toBeInTheDocument();
});

it('renders header actions as titled icon buttons', () => {
  installApi();
  render(<App />);

  expect(screen.getByRole('button', { name: 'باز کردن فایل' })).toHaveAttribute(
    'title',
    'باز کردن فایل',
  );
  expect(screen.getByRole('button', { name: 'حالت کتابخوان' })).toHaveAttribute(
    'title',
    'حالت کتابخوان (E-Ink)',
  );
  expect(screen.queryByText('باز کردن فایل')).not.toBeInTheDocument();
  expect(screen.queryByText('کتابخوان')).not.toBeInTheDocument();
});

it('opens a browser file locally and restores it after remounting', async () => {
  delete (window as Partial<Window>).electronAPI;
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await user.upload(
    screen.getByLabelText('انتخاب فایل متنی'),
    new File(['# یادداشت من\n\nHello'], 'note.md', { type: 'text/markdown' }),
  );
  expect(await screen.findByRole('heading', { name: 'یادداشت من' })).toBeInTheDocument();
  unmount();
  render(<App />);
  expect(screen.getByRole('heading', { name: 'یادداشت من' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'بستن note.md' }));
  expect(screen.queryByRole('heading', { name: 'یادداشت من' })).not.toBeInTheDocument();
});

it('rejects unsupported dropped files and retains the current document', async () => {
  delete (window as Partial<Window>).electronAPI;
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
  const article = screen.getByRole('article');
  fireEvent.drop(screen.getByRole('region', { name: 'محتوای سند' }), {
    dataTransfer: { files: [new File(['binary'], 'app.exe')] },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('فایل متنی');
  expect(article).toBeInTheDocument();
});

it('persists reading size, enforces bounds and resets preferences', async () => {
  installApi();
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
  for (let index = 0; index < 20; index++)
    await user.click(screen.getByRole('button', { name: 'بزرگ کردن متن' }));
  expect(screen.getByRole('button', { name: 'بزرگ کردن متن' })).toBeDisabled();
  expect(screen.getByRole('group', { name: 'اندازهٔ متن' })).toHaveTextContent('28');
  unmount();
  render(<App />);
  expect(screen.getByRole('article', { name: 'خوش‌آمدید.md' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'اندازهٔ متن' })).toHaveTextContent('28');
  await user.click(screen.getByRole('button', { name: 'بازنشانی تنظیمات خواندن' }));
  expect(screen.getByRole('group', { name: 'اندازهٔ متن' })).toHaveTextContent('18');
  expect(screen.getByRole('button', { name: 'بزرگ کردن متن' })).toBeEnabled();
});

it('exits focus mode with Escape and restores the outline', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('Focus'));
  await user.click(screen.getByRole('button', { name: 'حالت تمرکز' }));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'خروج از تمرکز' })).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

it('keeps every successful selection when requests resolve out of order', async () => {
  const user = userEvent.setup();
  const api = installApi();
  const first = deferred<DocumentPayload | null>();
  const second = deferred<DocumentPayload | null>();
  api.selectDocument.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  expect(screen.getByRole('status')).toHaveTextContent('در حال باز کردن فایل');
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  await act(async () => {
    second.resolve(payload('Second'));
  });
  expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
  await act(async () => {
    first.resolve(payload('First'));
  });
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('article', { name: 'First.md' })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  expect(screen.getByRole('article', { name: 'Second.md' })).toBeInTheDocument();
});

it('reports a newer dialog failure after an older dialog succeeds', async () => {
  const user = userEvent.setup();
  const api = installApi();
  const first = deferred<DocumentPayload | null>();
  const second = deferred<DocumentPayload | null>();
  api.selectDocument.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  await act(async () => first.resolve(payload('First')));
  expect(screen.getByRole('article', { name: 'First.md' })).toBeInTheDocument();
  await act(async () => second.reject(new Error('newer dialog failed')));
  expect(screen.getByRole('alert')).toHaveTextContent('باز کردن فایل ممکن نشد');
  expect(screen.getByRole('article', { name: 'First.md' })).toBeInTheDocument();
});

it('does not show an older dialog error after an OS-opened file', async () => {
  const user = userEvent.setup();
  const api = installApi();
  const request = deferred<DocumentPayload | null>();
  api.selectDocument.mockReturnValueOnce(request.promise);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  api.opened(payload('OS document'));
  await act(async () => {
    request.reject(new Error('Old read failed'));
  });
  expect(screen.getByRole('heading', { name: 'OS document' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/در حال باز کردن فایل/)).not.toBeInTheDocument();
});

it('cleans every StrictMode subscription and observer on unmount', () => {
  const api = installApi();
  const { unmount } = render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  api.opened(payload('Guide'));
  unmount();
  expect(api.unsubscribes).toHaveLength(2);
  for (const unsubscribe of api.unsubscribes) expect(unsubscribe).toHaveBeenCalledOnce();
  expect(observers.length).toBeGreaterThan(0);
  for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledOnce();
});

it('retains the current document after cancellation and offers Persian recovery after a read failure', async () => {
  const user = userEvent.setup();
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  expect(screen.getByRole('heading', { name: 'Guide' })).toBeInTheDocument();
  api.selectDocument.mockRejectedValueOnce(new Error('private filesystem error'));
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  expect(screen.getByRole('alert')).toHaveTextContent('باز کردن فایل ممکن نشد');
  expect(screen.getByRole('button', { name: 'انتخاب فایل دیگر' })).toBeEnabled();
  expect(screen.queryByText('private filesystem error')).not.toBeInTheDocument();
});

it('accepts empty documents and hides the outline for prose without headings', () => {
  const api = installApi();
  render(<App />);
  api.opened(payload('Empty', ''));
  expect(screen.getByText('این فایل خالی است.')).toBeInTheDocument();
  api.opened(payload('Prose', 'Just a paragraph.'));
  expect(screen.getByText('Just a paragraph.')).toHaveAttribute('dir', 'ltr');
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('restores and persists the manual theme', async () => {
  const user = userEvent.setup();
  installApi();
  localStorage.setItem('md-viewer-dark', 'true');
  render(<App />);
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await user.click(screen.getByRole('button', { name: 'فعال کردن حالت روشن' }));
  expect(localStorage.getItem('md-viewer-dark')).toBe('false');
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

it('keeps theme switching usable when local storage is unavailable', async () => {
  const user = userEvent.setup();
  installApi();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'فعال کردن حالت تیره' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('restores ebook mode after remounting and returns to the previous dark theme', async () => {
  installApi();
  const user = userEvent.setup();
  localStorage.setItem('md-viewer-dark', 'true');
  const { unmount } = render(<App />);
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'ebook-reader');
  expect(document.documentElement).not.toHaveClass('dark');
  expect(screen.getByRole('button', { name: 'حالت کتابخوان' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  unmount();
  render(<App />);
  expect(document.documentElement).toHaveAttribute('data-theme', 'ebook-reader');
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('preserves the document and reading settings while switching into ebook mode and back', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('Reading'));
  await user.click(screen.getByRole('button', { name: 'بزرگ کردن متن' }));
  await user.selectOptions(screen.getByLabelText('فاصلهٔ خطوط'), '2.2');
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(screen.getByRole('article', { name: 'Reading.md' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'اندازهٔ متن' })).toHaveTextContent('19');
  expect(screen.getByLabelText('فاصلهٔ خطوط')).toHaveValue('2.2');
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  await user.click(screen.getByRole('button', { name: 'فعال کردن حالت تیره' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('button', { name: 'حالت کتابخوان' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

it('returns from ebook to the previous theme even when storage is blocked', async () => {
  installApi();
  const user = userEvent.setup();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'فعال کردن حالت تیره' }));
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'ebook-reader');
  await user.click(screen.getByRole('button', { name: 'حالت کتابخوان' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
});

it('collapses and restores the desktop outline without discarding the document', async () => {
  const user = userEvent.setup();
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'پنهان کردن فهرست مطالب' }));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Guide' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'نمایش فهرست مطالب' }));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

it('uses reduced-motion navigation and closes the narrow drawer after selecting a heading', async () => {
  installMedia({ narrow: true, reduced: true });
  const user = userEvent.setup();
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'نمایش فهرست مطالب' });
  await user.click(trigger);
  const target = screen.getByRole('heading', { name: 'Windows' });
  const scroll = vi.fn();
  Object.defineProperty(target, 'scrollIntoView', { value: scroll, configurable: true });
  await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Windows' }));
  expect(scroll).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('closes an open drawer when resized to desktop', async () => {
  const resize = installMedia({ narrow: true });
  const user = userEvent.setup();
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  await user.click(screen.getByRole('button', { name: 'نمایش فهرست مطالب' }));
  act(() => resize(false));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
});

it('tracks geometry rather than only the latest observer batch, including upward scroll through long sections', async () => {
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  const positions = [20, 300, 800];
  const headings = ['Guide', 'Install', 'Windows'].map((name) =>
    screen.getByRole('heading', { name }),
  );
  headings.forEach((heading, index) =>
    vi
      .spyOn(heading, 'getBoundingClientRect')
      .mockImplementation(() => ({ top: positions[index] }) as DOMRect),
  );
  act(() => observers[observers.length - 1].callback([], {} as IntersectionObserver));
  expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'location');
  positions.splice(0, 3, -1000, -200, 500);
  act(() => observers[observers.length - 1].callback([], {} as IntersectionObserver));
  expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('aria-current', 'location');
  positions.splice(0, 3, -600, 250, 900);
  fireEvent.scroll(screen.getByRole('region', { name: 'محتوای سند' }));
  await vi.waitFor(() =>
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'location'),
  );
});

it('navigates document headings even when their IDs match application containers', async () => {
  const user = userEvent.setup();
  const api = installApi();
  const { container } = render(<App />);
  container.id = 'root';
  api.opened(payload('Collision', '# root\n\n## document-outline'));
  const heading = screen.getByRole('heading', { name: 'root' });
  const scroll = vi.fn();
  Object.defineProperty(heading, 'scrollIntoView', { value: scroll, configurable: true });
  await user.click(screen.getByRole('link', { name: 'root' }));
  expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(screen.getByRole('link', { name: 'root' })).toHaveAttribute('aria-current', 'location');
  expect(document.querySelectorAll('#document-outline')).toHaveLength(1);
});

it('marks the final section at the bottom even if that heading cannot reach the reading line', () => {
  const api = installApi();
  render(<App />);
  api.opened(payload('Guide'));
  const root = screen.getByRole('region', { name: 'محتوای سند' });
  Object.defineProperties(root, {
    scrollHeight: { value: 1800, configurable: true },
    clientHeight: { value: 800, configurable: true },
    scrollTop: { value: 1000, configurable: true },
  });
  ['Guide', 'Install', 'Windows'].forEach((name, index) => {
    vi.spyOn(screen.getByRole('heading', { name }), 'getBoundingClientRect').mockReturnValue({
      top: [-800, -500, 500][index],
    } as DOMRect);
  });
  act(() => observers[observers.length - 1].callback([], {} as IntersectionObserver));
  expect(screen.getByRole('link', { name: 'Windows' })).toHaveAttribute('aria-current', 'location');
});

it('cancels a pending scroll frame even when an observer notification arrives before unmount', () => {
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(1, callback);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const api = installApi();
  const { unmount } = render(<App />);
  api.opened(payload('Guide'));
  fireEvent.scroll(screen.getByRole('region', { name: 'محتوای سند' }));
  expect(frames.size).toBe(1);
  act(() => observers[observers.length - 1].callback([], {} as IntersectionObserver));
  unmount();
  expect(frames.size).toBe(0);
});

it('opens multiple documents as tabs and refreshes a duplicate in place', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('First'));
  expect(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toBeDisabled();
  api.opened(payload('Second'));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  api.opened({ ...payload('First', '# Updated'), documentId: 'fresh-render-id' });
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('heading', { name: 'Updated' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  await user.selectOptions(
    screen.getByLabelText('سند پنل دوم'),
    screen.getByRole('option', { name: 'Second.md' }),
  );
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getAllByRole('main')).toHaveLength(1);
});

it('closes inactive and active tabs, selects the nearest tab, and returns to the empty state', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  for (const name of ['First', 'Second', 'Third', 'Fourth']) api.opened(payload(name));
  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(screen.getByRole('tab', { name: 'Fourth.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('tab', { name: 'Third.md' }));
  await user.click(screen.getByRole('button', { name: 'بستن Third.md' }));
  expect(screen.getByRole('tab', { name: 'Second.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: 'بستن Second.md' }));
  expect(screen.getByRole('article', { name: 'Fourth.md' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'بستن Fourth.md' }));
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'فایل Markdown خود را باز کنید' }),
  ).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(workspaceStorageKey)!).tabs).toEqual([]);
});

it('clears split when its tab becomes active or closes and allows choosing a different second pane', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  for (const name of ['First', 'Second', 'Third']) api.opened(payload(name));
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  await user.selectOptions(
    screen.getByLabelText('سند پنل دوم'),
    screen.getByRole('option', { name: 'Second.md' }),
  );
  expect(screen.getByRole('article', { name: 'Second.md' })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  await user.click(screen.getByRole('button', { name: 'بستن نمای دوپنل' }));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getAllByRole('article')).toHaveLength(1);
});

it('persists tabs, activation and split in Electron and clears split on narrow resize and startup', async () => {
  const resize = installMedia();
  const api = installApi();
  const user = userEvent.setup();
  const first = render(<App />);
  api.opened(payload('First'));
  api.opened(payload('Second'));
  await user.click(screen.getByRole('tab', { name: 'First.md' }));
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  first.unmount();
  const second = render(<App />);
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  act(() => resize(true));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem(workspaceStorageKey)!).splitTabId).toBeNull();
  act(() => resize(false));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  second.unmount();
  installMedia({ narrow: true });
  render(<App />);
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /split/ })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(workspaceStorageKey)!).splitTabId).toBeNull();
});

it('turns restoration off by keyboard without closing current tabs and allows re-enabling it', async () => {
  const api = installApi();
  const user = userEvent.setup();
  const first = render(<App />);
  api.opened(payload('First'));
  api.opened(payload('Second'));
  const setting = screen.getByRole('checkbox', { name: 'بازگردانی تب‌ها هنگام شروع' });
  expect(setting).toBeChecked();
  setting.focus();
  await user.keyboard(' ');
  expect(setting).not.toBeChecked();
  expect(localStorage.getItem(restoreTabsStorageKey)).toBe('false');
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  first.unmount();
  const second = render(<App />);
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
  expect(screen.getByRole('checkbox', { name: 'بازگردانی تب‌ها هنگام شروع' })).not.toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: 'بازگردانی تب‌ها هنگام شروع' }));
  second.unmount();
  render(<App />);
  expect(screen.getByRole('article', { name: 'خوش‌آمدید.md' })).toBeInTheDocument();
});

it('keeps browser uploads and drops as tabs, reuses duplicate content and closes only the active tab', async () => {
  delete (window as Partial<Window>).electronAPI;
  const user = userEvent.setup();
  render(<App />);
  const file = () => new File(['# Browser'], 'note.md', { type: 'text/markdown' });
  await user.upload(screen.getByLabelText('انتخاب فایل متنی'), file());
  fireEvent.drop(screen.getByRole('region', { name: 'محتوای سند' }), {
    dataTransfer: { files: [new File(['# Dropped'], 'drop.md')] },
  });
  expect(await screen.findByRole('heading', { name: 'Dropped' })).toBeInTheDocument();
  await user.upload(screen.getByLabelText('انتخاب فایل متنی'), file());
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'note.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: 'بستن note.md' }));
  expect(screen.getByRole('article', { name: 'drop.md' })).toBeInTheDocument();
  expect(screen.getAllByRole('tab')).toHaveLength(1);
});

it('invalidates a pending dialog after an OS open and ignores results after unmount', async () => {
  const api = installApi();
  const user = userEvent.setup();
  const request = deferred<DocumentPayload | null>();
  const abandoned = deferred<DocumentPayload | null>();
  api.selectDocument.mockReturnValueOnce(request.promise).mockReturnValueOnce(abandoned.promise);
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  api.opened(payload('OS'));
  await act(async () => request.resolve(payload('Dialog')));
  expect(screen.getAllByRole('tab')).toHaveLength(1);
  expect(screen.getByRole('tab', { name: 'OS.md' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Dialog.md' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'باز کردن فایل' }));
  view.unmount();
  await act(async () => abandoned.resolve(payload('Abandoned')));
  render(<App />);
  expect(screen.getAllByRole('tab')).toHaveLength(1);
  expect(screen.queryByRole('tab', { name: 'Abandoned.md' })).not.toBeInTheDocument();
});

it('retains independent scroll positions and scoped navigation across tabs and split panes', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('First'));
  const primary = screen.getByRole('region', { name: 'محتوای سند' });
  fireEvent.scroll(primary, { target: { scrollTop: 240 } });
  api.opened(payload('Second'));
  await vi.waitFor(() => expect(primary.scrollTop).toBe(0));
  fireEvent.scroll(primary, { target: { scrollTop: 580 } });
  await user.click(screen.getByRole('tab', { name: 'First.md' }));
  await vi.waitFor(() => expect(primary.scrollTop).toBe(240));
  await user.click(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' }));
  const secondary = screen.getAllByRole('region', { name: 'محتوای سند' })[1];
  await vi.waitFor(() => expect(secondary.scrollTop).toBe(580));
  const primaryScroll = vi.fn();
  const secondaryScroll = vi.fn();
  Object.defineProperty(
    within(primary).getByRole('heading', { name: 'Install' }),
    'scrollIntoView',
    { value: primaryScroll },
  );
  Object.defineProperty(
    within(secondary).getByRole('heading', { name: 'Install' }),
    'scrollIntoView',
    { value: secondaryScroll },
  );
  await user.click(within(secondary).getByRole('link', { name: 'Install' }));
  expect(secondaryScroll).toHaveBeenCalledOnce();
  expect(primaryScroll).not.toHaveBeenCalled();
  expect(primary.scrollTop).toBe(240);
  fireEvent.scroll(secondary, { target: { scrollTop: 720 } });
  await user.click(screen.getByRole('button', { name: 'بستن نمای دوپنل' }));
  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  await vi.waitFor(() => expect(primary.scrollTop).toBe(720));
});

it('keeps workspace and restore settings usable when storage fails and clears the notice after recovery', async () => {
  const api = installApi();
  const user = userEvent.setup();
  render(<App />);
  api.opened(payload('First'));
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  api.opened(payload('Second'));
  expect(screen.getByRole('alert')).toHaveTextContent('تب');
  await user.click(screen.getByRole('checkbox', { name: 'بازگردانی تب‌ها هنگام شروع' }));
  expect(screen.getAllByRole('tab')).toHaveLength(2);
  expect(screen.getByRole('checkbox', { name: 'بازگردانی تب‌ها هنگام شروع' })).not.toBeChecked();
  storage.mockRestore();
  await user.click(screen.getByRole('tab', { name: 'First.md' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(localStorage.getItem(restoreTabsStorageKey)).toBe('false');
});
