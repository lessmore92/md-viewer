import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installDialog } from '../test/browser';
import { SidebarDrawer } from './SidebarDrawer';

beforeEach(installDialog);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>نمایش فهرست مطالب</button>
      <SidebarDrawer open={open} onClose={() => setOpen(false)}>
        <a href="#last">Last section</a>
      </SidebarDrawer>
    </>
  );
}

it('moves focus into the dialog, traps Tab in both directions, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const trigger = screen.getByRole('button', { name: 'نمایش فهرست مطالب' });
  await user.click(trigger);
  const close = screen.getByRole('button', { name: 'بستن فهرست مطالب' });
  expect(screen.getByRole('dialog', { name: 'فهرست مطالب' })).toHaveAttribute('aria-modal', 'true');
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByRole('link', { name: 'Last section' })).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('closes only on backdrop clicks, not clicks inside the drawer', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const trigger = screen.getByRole('button', { name: 'نمایش فهرست مطالب' });
  await user.click(trigger);
  await user.click(screen.getByRole('heading', { name: 'فهرست مطالب' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('dialog'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it('renders no dialog when closed', () => {
  render(
    <SidebarDrawer open={false} onClose={vi.fn()}>
      Content
    </SidebarDrawer>,
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
