import { useState } from 'react';
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
  render(<TabBar tabs={tabs} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />);

  expect(screen.getByRole('tablist', { name: 'سندهای باز' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('title', 'First.md');
  expect(screen.getByRole('tab', { name: 'Second.md' })).toHaveAttribute('aria-selected', 'false');

  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  expect(handlers.onActivate).toHaveBeenCalledWith('second');

  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(handlers.onClose).toHaveBeenCalledWith('first');
  expect(handlers.onActivate).toHaveBeenCalledTimes(1);
});

it('does not reference panels that the standalone tab bar does not render', () => {
  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId={null}
      narrow={false}
      {...createHandlers()}
    />,
  );

  for (const tab of screen.getAllByRole('tab')) {
    expect(tab).not.toHaveAttribute('aria-controls');
  }
});

it('toggles split mode with an accessible pressed state', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  const { rerender } = render(
    <TabBar tabs={tabs} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />,
  );

  const enableSplit = screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' });
  expect(enableSplit).toHaveAttribute('title', 'فعال کردن نمای دوپنل');
  expect(enableSplit).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByLabelText('سند پنل دوم')).not.toBeInTheDocument();
  await user.click(enableSplit);
  expect(handlers.onToggleSplit).toHaveBeenCalledTimes(1);

  rerender(
    <TabBar tabs={tabs} activeTabId="first" splitTabId="second" narrow={false} {...handlers} />,
  );

  expect(screen.getByRole('button', { name: 'بستن نمای دوپنل' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('keeps a disabled Split action visible when only one tab is open on desktop', () => {
  const handlers = createHandlers();
  render(
    <TabBar tabs={[tabs[0]]} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />,
  );

  expect(screen.getByRole('button', { name: 'فعال کردن نمای دوپنل' })).toBeDisabled();
});

it('offers only non-active tabs to the split selector', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  render(
    <TabBar tabs={tabs} activeTabId="first" splitTabId="second" narrow={false} {...handlers} />,
  );

  expect(screen.getByLabelText('سند پنل دوم')).toHaveValue('second');
  expect(screen.getByRole('option', { name: 'First.md' })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Second.md' })).not.toBeDisabled();

  await user.selectOptions(screen.getByLabelText('سند پنل دوم'), 'first');
  expect(handlers.onSelectSplit).not.toHaveBeenCalled();

  await user.selectOptions(screen.getByLabelText('سند پنل دوم'), 'third');
  expect(handlers.onSelectSplit).toHaveBeenCalledWith('third');
});

it('hides split controls in narrow mode', () => {
  const handlers = createHandlers();
  render(<TabBar tabs={tabs} activeTabId="first" splitTabId="second" narrow {...handlers} />);

  expect(screen.queryByRole('button', { name: /split/u })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('سند پنل دوم')).not.toBeInTheDocument();
});

it('allows keyboard users to reach and activate inactive tabs', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  render(<TabBar tabs={tabs} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />);

  await user.tab();
  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'بستن First.md' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('tab', { name: 'Second.md' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(handlers.onActivate).toHaveBeenCalledWith('second');
});

it.each([
  ['first', 'First.md', 'Second.md'],
  ['second', 'Second.md', 'Third.md'],
  ['third', 'Third.md', 'Second.md'],
])('preserves focus after closing %s in stable tab order', async (tabId, fileName, nextName) => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  const { rerender } = render(
    <TabBar tabs={tabs} activeTabId="first" splitTabId={null} narrow={false} {...handlers} />,
  );

  await user.click(screen.getByRole('button', { name: `بستن ${fileName}` }));
  rerender(
    <TabBar
      tabs={tabs.filter((tab) => tab.tabId !== tabId)}
      activeTabId={tabId === 'first' ? 'second' : 'first'}
      splitTabId={null}
      narrow={false}
      {...handlers}
    />,
  );
  expect(screen.getByRole('tab', { name: nextName })).toHaveFocus();
  expect(handlers.onActivate).not.toHaveBeenCalled();
  await user.keyboard(' ');
  expect(handlers.onActivate).toHaveBeenCalledWith(nextName === 'Third.md' ? 'third' : 'second');
});

it('keeps focus on the tab strip when the last document is closed in narrow mode', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  const { rerender } = render(
    <TabBar tabs={[tabs[0]]} activeTabId="first" splitTabId={null} narrow {...handlers} />,
  );

  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  rerender(<TabBar tabs={[]} activeTabId={null} splitTabId={null} narrow {...handlers} />);
  expect(screen.getByRole('tablist', { name: 'سندهای باز' })).toHaveFocus();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});

it('moves keyboard focus to the nearest remaining tab when a named close button removes a document', async () => {
  const user = userEvent.setup();
  const handlers = createHandlers();
  function ClosingTabs() {
    const [openTabs, setOpenTabs] = useState(tabs);
    return (
      <TabBar
        tabs={openTabs}
        activeTabId={openTabs[0]?.tabId ?? null}
        splitTabId={null}
        narrow={false}
        {...handlers}
        onClose={(tabId) => setOpenTabs((current) => current.filter((tab) => tab.tabId !== tabId))}
      />
    );
  }

  render(<ClosingTabs />);
  await user.tab();
  await user.tab();
  expect(screen.getByRole('button', { name: 'بستن First.md' })).toHaveFocus();
  await user.keyboard('{Enter}');

  expect(screen.queryByRole('tab', { name: 'First.md' })).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Second.md' })).toHaveFocus();
  expect(handlers.onActivate).not.toHaveBeenCalled();
});
