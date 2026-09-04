import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { WorkspaceTab } from '../app/workspace';
import { TabBar } from './TabBar';

function tab(tabId: string, fileName: string): WorkspaceTab {
  return {
    tabId,
    document: {
      fileName,
      filePath: `C:\\docs\\${fileName}`,
      documentId: tabId,
      content: `# ${fileName}`,
    },
    documentKey: `path:c:/docs/${fileName.toLowerCase()}`,
    scrollTop: 0,
  };
}

function handlers() {
  return {
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onToggleSplit: vi.fn(),
    onSelectSplit: vi.fn(),
  };
}

const tabs = [tab('first', 'First.md'), tab('second', 'Second.md'), tab('third', 'Third.md')];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('marks the active tab and exposes a close button by file name', async () => {
  const user = userEvent.setup();
  const actions = handlers();

  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId={null}
      narrow={false}
      {...actions}
    />,
  );

  expect(screen.getByRole('tab', { name: 'First.md' })).toHaveAttribute('aria-selected', 'true');
  await user.click(screen.getByRole('button', { name: 'بستن First.md' }));
  expect(actions.onClose).toHaveBeenCalledWith('first');
});

it('activates tabs, toggles split mode, and keeps the split selector limited to other tabs', async () => {
  const user = userEvent.setup();
  const actions = handlers();

  render(
    <TabBar
      tabs={tabs}
      activeTabId="first"
      splitTabId="second"
      narrow={false}
      {...actions}
    />,
  );

  await user.click(screen.getByRole('tab', { name: 'Second.md' }));
  expect(actions.onActivate).toHaveBeenCalledWith('second');

  expect(screen.getByRole('button', { name: 'بستن split' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByLabelText('سند پنل دوم')).toHaveValue('second');
  expect(screen.getByRole('option', { name: 'First.md' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'بستن split' }));
  expect(actions.onToggleSplit).toHaveBeenCalledTimes(1);
});

it('hides the split controls when the layout is narrow', () => {
  const actions = handlers();

  render(
    <TabBar tabs={tabs} activeTabId="first" splitTabId="second" narrow={true} {...actions} />,
  );

  expect(screen.queryByRole('button', { name: 'بستن split' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('سند پنل دوم')).not.toBeInTheDocument();
});
