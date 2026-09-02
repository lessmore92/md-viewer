import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentPayload } from '../../electron/contracts';
import { MarkdownView } from './MarkdownView';

function installElectronApi() {
  const assetUrl = vi.fn(
    (documentId: string, relativePath: string) => `md-asset://local/${documentId}/${relativePath}`,
  );
  const openExternal = vi.fn(async () => true);

  window.electronAPI = {
    assetUrl,
    openExternal,
    onDocumentOpened: vi.fn((callback: (document: DocumentPayload) => void) => {
      void callback;
      return () => undefined;
    }),
    selectDocument: vi.fn(async () => null),
  };

  return { assetUrl, openExternal };
}

describe('MarkdownView', () => {
  afterEach(cleanup);

  beforeEach(() => {
    installElectronApi();
  });

  it('renders headings, inline and fenced code, and GFM table headers semantically', () => {
    const { container } = render(
      <MarkdownView
        content={'# Title\n\nUse `npm test`.\n\n```ts\nconst x = 1\n```\n\n| H |\n|---|\n| C |'}
        documentId="doc-1"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toHaveAttribute('id', 'title');
    expect(screen.getByText('npm test').closest('pre')).toBeNull();
    expect(container.querySelector('pre code')).toHaveTextContent('const x = 1');
    expect(screen.getByRole('columnheader', { name: 'H' }).tagName).toBe('TH');
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('deduplicates heading IDs and reports the matching H1-H3 outline', () => {
    const onHeadingsChange = vi.fn();

    render(
      <MarkdownView
        content={'# Intro\n## Intro\n#### Intro\n### نصب'}
        documentId="doc-1"
        onHeadingsChange={onHeadingsChange}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Intro' })).toHaveAttribute('id', 'intro');
    expect(screen.getByRole('heading', { level: 2, name: 'Intro' })).toHaveAttribute(
      'id',
      'intro-1',
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Intro' })).toHaveAttribute(
      'id',
      'intro-2',
    );
    expect(onHeadingsChange).toHaveBeenLastCalledWith([
      {
        id: 'intro',
        depth: 1,
        text: 'Intro',
        children: [
          {
            id: 'intro-1',
            depth: 2,
            text: 'Intro',
            children: [{ id: 'نصب', depth: 3, text: 'نصب', children: [] }],
          },
        ],
      },
    ]);
  });

  it('uses visible raw HTML heading text for matching duplicate renderer and outline IDs', () => {
    const onHeadingsChange = vi.fn();

    render(
      <MarkdownView
        content={'# Press <kbd>Ctrl</kbd>\n\n## Press <kbd>Ctrl</kbd>'}
        documentId="doc-1"
        onHeadingsChange={onHeadingsChange}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Press Ctrl' })).toHaveAttribute(
      'id',
      'press-ctrl',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Press Ctrl' })).toHaveAttribute(
      'id',
      'press-ctrl-1',
    );
    expect(onHeadingsChange).toHaveBeenLastCalledWith([
      {
        id: 'press-ctrl',
        depth: 1,
        text: 'Press Ctrl',
        children: [{ id: 'press-ctrl-1', depth: 2, text: 'Press Ctrl', children: [] }],
      },
    ]);
  });

  it('restores generated heading IDs without disabling raw HTML clobber protection', () => {
    const { container } = render(
      <MarkdownView
        content={
          '# Safe\n\n<div id="safe" name="constructor">Raw div</div>\n\n<h2 id="location">Raw heading</h2>'
        }
        documentId="doc-1"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Safe' })).toHaveAttribute('id', 'safe');
    expect(screen.getByText('Raw div')).toHaveAttribute('id', 'user-content-safe');
    expect(screen.getByText('Raw div')).toHaveAttribute('name', 'user-content-constructor');
    expect(screen.getByRole('heading', { level: 2, name: 'Raw heading' })).toHaveAttribute(
      'id',
      'user-content-location',
    );
    expect(container.querySelectorAll('#safe')).toHaveLength(1);
  });

  it('parses safe raw HTML but strips active content and event handlers', () => {
    const { container } = render(
      <MarkdownView
        content={
          '<script>window.pwned = true</script>\n\n<details open onclick="window.pwned=true"><summary>More</summary><kbd>Ctrl</kbd></details>\n\n[unsafe](javascript:alert(1))'
        }
        documentId="doc-1"
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container).not.toHaveTextContent('window.pwned = true');
    const details = screen.getByText('More').closest('details');
    expect(details).toBeInTheDocument();
    expect(details).toHaveAttribute('open');
    expect(details).not.toHaveAttribute('onclick');
    expect(screen.getByText('Ctrl').tagName).toBe('KBD');
    expect(screen.getByText('unsafe').closest('a')).not.toHaveAttribute('href');
  });

  it('removes raw picture sources and srcset candidates from sanitized output', () => {
    const { container } = render(
      <MarkdownView
        content={
          '<picture><source srcset="https://attacker.example/track.png 1x, images/alternate.png 2x"><img src="images/fallback.png" srcset="images/bypass.png 2x" alt="Fallback"></picture>'
        }
        documentId="doc-1"
      />,
    );

    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('source')).toBeNull();
    expect(container.querySelector('[srcset]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Fallback' })).toHaveAttribute(
      'src',
      'md-asset://local/doc-1/images/fallback.png',
    );
  });

  it('renders supported GitHub alerts without changing ordinary blockquotes', () => {
    const { container } = render(
      <MarkdownView
        content={
          '> [!NOTE]\n> Read this first.\n\n> [!WARNING] Keep **backups**.\n\n> Ordinary quote.'
        }
        documentId="doc-1"
      />,
    );

    const note = screen.getByText('Read this first.').closest('blockquote');
    const warning = screen.getByText('backups').closest('blockquote');
    const ordinary = screen.getByText('Ordinary quote.').closest('blockquote');

    expect(note).toHaveAttribute('data-alert', 'note');
    expect(note).toHaveClass('markdown-alert-note');
    expect(note).toHaveTextContent('Note');
    expect(warning).toHaveAttribute('data-alert', 'warning');
    expect(warning).toHaveClass('markdown-alert-warning');
    expect(warning).toHaveTextContent('Warning');
    expect(ordinary).not.toHaveAttribute('data-alert');
    expect(container.querySelectorAll('.markdown-alert')).toHaveLength(2);
  });

  it('rewrites relative images and preserves safe remote and data image sources', () => {
    const { assetUrl } = installElectronApi();

    render(
      <MarkdownView
        content={
          '![Local](images/diagram.png)\n\n![Remote](https://example.com/a.png)\n\n![Embedded](data:image/png;base64,AAAA)'
        }
        documentId="doc-7"
      />,
    );

    expect(screen.getByRole('img', { name: 'Local' })).toHaveAttribute(
      'src',
      'md-asset://local/doc-7/images/diagram.png',
    );
    expect(assetUrl).toHaveBeenCalledWith('doc-7', 'images/diagram.png');
    expect(screen.getByRole('img', { name: 'Remote' })).toHaveAttribute(
      'src',
      'https://example.com/a.png',
    );
    expect(screen.getByRole('img', { name: 'Embedded' })).toHaveAttribute(
      'src',
      'data:image/png;base64,AAAA',
    );
  });

  it('shows a compact fallback when an image fails to load', () => {
    render(<MarkdownView content={'![Diagram](images/missing.png)'} documentId="doc-1" />);

    fireEvent.error(screen.getByRole('img', { name: 'Diagram' }));

    expect(screen.getByRole('status')).toHaveTextContent('images/missing.png');
  });

  it('delegates external links to the preload bridge', async () => {
    const user = userEvent.setup();
    const { openExternal } = installElectronApi();
    render(<MarkdownView content={'[GitHub](https://github.com)'} documentId="doc-1" />);

    await user.click(screen.getByRole('link', { name: 'GitHub' }));

    expect(openExternal).toHaveBeenCalledWith('https://github.com');
  });

  it('does not leave relative document links navigable inside Electron', () => {
    render(<MarkdownView content={'[Guide](guide.md)'} documentId="doc-1" />);

    expect(screen.getByText('Guide').closest('a')).not.toHaveAttribute('href');
  });

  it('scrolls fragment targets inside the current document', async () => {
    const user = userEvent.setup();
    render(<MarkdownView content={'[Jump](#target)\n\n## Target'} documentId="doc-1" />);
    const target = screen.getByRole('heading', { level: 2, name: 'Target' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scrollIntoView });

    await user.click(screen.getByRole('link', { name: 'Jump' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('copies fenced code through the accessible copy control', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<MarkdownView content={'```js\nconsole.log(1)\n```'} documentId="doc-1" />);

    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(writeText).toHaveBeenCalledWith('console.log(1)\n');
  });

  it('keeps nested inline markup and hard line breaks while applying block direction', () => {
    const { container } = render(
      <MarkdownView content={'متن فارسی  \n**English**'} documentId="doc-1" />,
    );

    const paragraph = screen.getByText('English').closest('p');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
    expect(paragraph?.querySelector('strong')).toHaveTextContent('English');
    expect(paragraph?.querySelector('br')).toBeInTheDocument();
    expect(container.querySelector('p > span[dir]')).toBeNull();
  });
});
