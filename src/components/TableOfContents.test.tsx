import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { HeadingItem } from '../markdown/headings';
import { TableOfContents } from './TableOfContents';

afterEach(cleanup);

const headings: HeadingItem[] = [
  {
    id: 'intro',
    depth: 1,
    text: 'Intro',
    children: [
      {
        id: 'install',
        depth: 2,
        text: 'Install',
        children: [{ id: 'windows', depth: 3, text: 'Windows', children: [] }],
      },
    ],
  },
];

it('nests H1-H3 links, marks the active location, and navigates without changing the URL', async () => {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  render(<TableOfContents headings={headings} activeId="install" onNavigate={onNavigate} />);
  const navigation = screen.getByRole('navigation', { name: 'فهرست مطالب' });
  expect(within(navigation).getAllByRole('list')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('aria-current', 'location');
  expect(screen.getByRole('link', { name: 'Intro' })).not.toHaveAttribute('aria-current');
  const windows = screen.getByRole('link', { name: 'Windows' });
  expect(windows.closest('ul')?.parentElement).toHaveTextContent('Install');
  await user.click(windows);
  expect(onNavigate).toHaveBeenCalledWith('windows');
  expect(window.location.hash).toBe('');
});

it('does not expose an empty navigation landmark', () => {
  render(<TableOfContents headings={[]} activeId={null} onNavigate={vi.fn()} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

it('isolates mixed-direction labels and URL-encodes fragment IDs', () => {
  render(
    <TableOfContents
      headings={[{ id: 'نصب', depth: 2, text: 'نصب npm', children: [] }]}
      activeId={null}
      onNavigate={vi.fn()}
    />,
  );
  expect(screen.getByRole('link', { name: 'نصب npm' })).toHaveAttribute(
    'href',
    '#%D9%86%D8%B5%D8%A8',
  );
  expect(screen.getByText('نصب npm')).toHaveAttribute('dir', 'auto');
});
