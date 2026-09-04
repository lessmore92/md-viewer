import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WorkspaceTab } from '../app/workspace';
import App from '../app/App';
import { installDialog, installMedia } from '../test/browser';
import { DocumentPane } from './DocumentPane';

function tab(name: string, content = `# ${name}\n\n## Shared\n\n[Jump](#shared)`): WorkspaceTab {
  return {
    tabId: name,
    documentKey: name,
    document: { fileName: `${name}.md`, filePath: '', documentId: name, content },
    scrollTop: 0,
  };
}

const handlers = { onNavigate: vi.fn(), onClose: vi.fn(), onScrollTop: vi.fn() };

beforeEach(() => {
  localStorage.clear();
  delete (window as Partial<Window>).electronAPI;
  installMedia();
  installDialog();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders its own document, outline, and reading status', () => {
  render(
    <DocumentPane
      tab={tab('Guide')}
      showSidebar
      loading={false}
      error=""
      paneId="primary"
      {...handlers}
    />,
  );
  expect(screen.getByRole('article', { name: 'Guide.md' })).toHaveAttribute('dir', 'ltr');
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'پیشرفت مطالعه' })).toBeInTheDocument();
});

it('scopes outline and fragment navigation to its pane despite duplicate heading IDs', async () => {
  const user = userEvent.setup();
  render(
    <main>
      <DocumentPane
        tab={tab('First')}
        showSidebar
        loading={false}
        error=""
        paneId="primary"
        {...handlers}
      />
      <DocumentPane
        tab={tab('Second')}
        showSidebar
        loading={false}
        error=""
        paneId="secondary"
        {...handlers}
      />
    </main>,
  );
  expect(screen.getAllByRole('main')).toHaveLength(1);
  const [first, second] = within(screen.getByRole('main')).getAllByRole('region');
  const firstScroll = vi.fn();
  const secondScroll = vi.fn();
  Object.defineProperty(within(first).getByRole('heading', { name: 'Shared' }), 'scrollIntoView', {
    value: firstScroll,
  });
  Object.defineProperty(within(second).getByRole('heading', { name: 'Shared' }), 'scrollIntoView', {
    value: secondScroll,
  });
  await user.click(within(second).getByRole('link', { name: 'Shared' }));
  await user.click(within(second).getByRole('link', { name: 'Jump' }));
  expect(firstScroll).not.toHaveBeenCalled();
  expect(secondScroll).toHaveBeenCalledTimes(2);
  expect(handlers.onNavigate).toHaveBeenLastCalledWith('shared', 'secondary');
  expect(within(second).getByRole('link', { name: 'Shared' })).toHaveAttribute(
    'aria-current',
    'location',
  );
});

it('restores each tab scroll position and reports pane scrolling', async () => {
  const first = { ...tab('First'), scrollTop: 140 };
  const second = { ...tab('Second'), scrollTop: 280 };
  const props = {
    showSidebar: true,
    loading: false,
    error: '',
    paneId: 'primary' as const,
    ...handlers,
  };
  const { rerender } = render(<DocumentPane tab={first} {...props} />);
  const root = screen.getByLabelText('محتوای سند');
  await waitFor(() => expect(root.scrollTop).toBe(140));
  fireEvent.scroll(root, { target: { scrollTop: 190 } });
  expect(handlers.onScrollTop).toHaveBeenLastCalledWith(190);
  rerender(<DocumentPane tab={second} {...props} />);
  await waitFor(() => expect(root.scrollTop).toBe(280));
  rerender(<DocumentPane tab={{ ...first, scrollTop: 190 }} {...props} />);
  await waitFor(() => expect(root.scrollTop).toBe(190));
});

it('keeps the page main in App around the document pane', async () => {
  const user = userEvent.setup();
  render(<App />);
  const main = screen.getByRole('main');
  expect(within(main).getByRole('region', { name: 'محتوای سند' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'مشاهدهٔ نمونه' }));
  expect(screen.getAllByRole('main')).toHaveLength(1);
  expect(within(main).getByRole('article')).toBeInTheDocument();
});

it('does not schedule restoration for scroll feedback but restores saved positions and documents', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const flushFrames = () =>
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    });
  const first = { ...tab('First'), scrollTop: 140 };
  const props = {
    showSidebar: true,
    loading: false,
    error: '',
    paneId: 'primary' as const,
    ...handlers,
  };
  const { rerender, unmount } = render(<DocumentPane tab={first} {...props} />);
  const root = screen.getByLabelText('محتوای سند');
  flushFrames();
  expect(root.scrollTop).toBe(140);
  const writeScrollTop = vi.spyOn(root, 'scrollTop', 'set');

  for (const scrollTop of [190, 240, 310]) {
    fireEvent.scroll(root, { target: { scrollTop } });
    expect(handlers.onScrollTop).toHaveBeenLastCalledWith(scrollTop);
    writeScrollTop.mockClear();
    requestFrame.mockClear();
    // Echo the saved position back just as App's state update does.
    rerender(<DocumentPane tab={{ ...first, scrollTop }} {...props} />);
    expect(requestFrame).not.toHaveBeenCalled();
    flushFrames();
    expect(writeScrollTop).not.toHaveBeenCalled();
    expect(root.scrollTop).toBe(scrollTop);
  }

  // A new document in the same tab must restore even if its position matches the last report.
  const replacement = { ...first, document: tab('Replacement').document, scrollTop: 310 };
  rerender(<DocumentPane tab={replacement} {...props} />);
  flushFrames();
  expect(writeScrollTop).toHaveBeenCalledWith(310);
  expect(root.scrollTop).toBe(310);

  rerender(<DocumentPane tab={{ ...replacement, scrollTop: 75 }} {...props} />);
  flushFrames();
  expect(root.scrollTop).toBe(75);

  rerender(<DocumentPane tab={{ ...first, scrollTop: 500 }} {...props} />);
  expect(frames.size).toBeGreaterThan(0);
  unmount();
  expect(frames.size).toBe(0);
});

it('renders loading and errors without removing the current document and handles empty content', () => {
  const props = { showSidebar: true, paneId: 'primary' as const, ...handlers };
  const { rerender } = render(
    <DocumentPane tab={tab('Guide')} loading error="Read failed" {...props} />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('در حال باز کردن فایل');
  expect(screen.getByRole('alert')).toHaveTextContent('Read failed');
  expect(screen.getByRole('article', { name: 'Guide.md' })).toBeInTheDocument();
  rerender(<DocumentPane tab={tab('Empty', '')} loading={false} error="" {...props} />);
  expect(screen.getByText('این فایل خالی است.')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
