import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { WorkspaceTab } from '../app/workspace';
import { TabBar } from './TabBar';

afterEach(cleanup);

const tabs: WorkspaceTab[] = [
  {
    tabId: 'first',
    documentKey: 'path:first',
    scrollTop: 0,
    document: {
      documentId: 'doc-1',
      fileName: 'First.md',
      filePath: '/docs/First.md',
      content: '# First',
    },
  },
  {
    tabId: 'second',
    documentKey: 'path:second',
    scrollTop: 0,
    document: {
      documentId: 'doc-2',
      fileName: 'Second.md',
      filePath: '/docs/Second.md',
      content: '# Second',
    },
  },
  {
    tabId: 'third',
    documentKey: 'path:third',
    scrollTop: 0,
    document: {
      documentId: 'doc-3',
      fileName: 'Third.md',
      filePath: '/docs/Third.md',
      content: '# Third',
    },
  },
];

function createHandlers() {
  return {
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onToggleSplit: vi.fn(),
    onSelectSplit: vi.fn(),
  };
}

it('marks the active tab, lets people activate another tab, and closes by file name', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId={null}
      narrow={false}
      {...handlers}
    />,
  );

  expect(screen.getByRole('tablist', { name: 'سندهای باز' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Second.md' })).toHaveAttribute('aria-selected', 'false');

  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  expect(handlers.onActivate).toHaveBeenCalledWith('second');

  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(handlers.onClose).toHaveBeenCalledWith('first');
});

it('toggles split mode with an accessible pressed state', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  const { rerender } = render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId={null}
      narrow={false}
      {...handlers}
    />,
  );

  const enableSplit = screen.getByRole('button', { name: 'فعال کردن split' });
  expect(enableSplit).toHaveAttribute('aria-pressed', 'false');
  await user.click(enableSplit);
  expect(handlers.onToggleSplit).toHaveBeenCalledTimes(1);

  rerender(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId="second"
      narrow={false}
      {...handlers}
    />,
  );

  expect(screen.getByRole('button', { name: 'بستن split' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('offers only non-active tabs to the split selector', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId="second"
      narrow={false}
      {...handlers}
    />,
  );

  expect(screen.getByLabelText('سند پنل دوم')).toHaveValue('second');
  expect(screen.getByRole('option', { name: 'First.md' })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Second.md' })).not.toBeDisabled();

  await user.selectOptions(screen.getByLabelText('سند پنل دوم'), 'third');
  expect(handlers.onSelectSplit).toHaveBeenCalledWith('third');
});

it('hides split controls in narrow mode', () => {
  const handlers = createHandlers();
  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId="second"
      narrow
      {...handlers}
    />,
  );

  expect(screen.queryByRole('button', { name: /split/u })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('سند پنل دوم')).not.toBeInTheDocument();
});
