import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import { installDialog, installMedia } from '../test/browser';
import App from './App';

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
  await user.click(screen.getByRole('button', { name: 'بستن و پاک کردن سند ذخیره‌شده' }));
  expect(screen.queryByRole('heading', { name: 'یادداشت من' })).not.toBeInTheDocument();
});

it('rejects unsupported dropped files and retains the current document', async () => {
  delete (window as Partial<Window>).electronAPI;
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
  const article = screen.getByRole('article');
  fireEvent.drop(screen.getByRole('main'), {
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
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
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

it('keeps the most recent selection when requests resolve out of order', async () => {
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
  expect(screen.queryByRole('heading', { name: 'First' })).not.toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Second.md' })).toBeInTheDocument();
});

it('does not replace an OS-opened file with an older dialog result or error', async () => {
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
  fireEvent.scroll(screen.getByRole('main'));
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
  const root = screen.getByRole('main');
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
  fireEvent.scroll(screen.getByRole('main'));
  expect(frames.size).toBe(1);
  act(() => observers[observers.length - 1].callback([], {} as IntersectionObserver));
  unmount();
  expect(frames.size).toBe(0);
});
