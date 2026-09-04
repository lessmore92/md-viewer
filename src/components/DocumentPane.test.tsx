import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WorkspaceTab } from '../app/workspace';
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
    <>
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
    </>,
  );
  const [first, second] = screen.getAllByRole('main');
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
  const root = screen.getByRole('main');
  await waitFor(() => expect(root.scrollTop).toBe(140));
  fireEvent.scroll(root, { target: { scrollTop: 190 } });
  expect(handlers.onScrollTop).toHaveBeenLastCalledWith(190);
  rerender(<DocumentPane tab={second} {...props} />);
  await waitFor(() => expect(root.scrollTop).toBe(280));
  rerender(<DocumentPane tab={{ ...first, scrollTop: 190 }} {...props} />);
  await waitFor(() => expect(root.scrollTop).toBe(190));
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
