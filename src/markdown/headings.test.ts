import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { createHeadingIdPlugin, extractHeadings } from './headings';

interface HeadingLike {
  id: string;
  children: HeadingLike[];
}

function flattenIds(item: HeadingLike): string[] {
  return [item.id, ...item.children.flatMap(flattenIds)];
}

describe('extractHeadings', () => {
  it('builds an H1-H3 tree and ignores deeper headings', () => {
    expect(extractHeadings('# Intro\n## Install\n### Windows\n#### Detail\n## API')).toEqual([
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
          { id: 'api', depth: 2, text: 'API', children: [] },
        ],
      },
    ]);
  });

  it('uses deterministic GitHub slugs for duplicates and Persian headings', () => {
    expect(extractHeadings('# نصب\n## نصب\n## Hello, World!').map(flattenIds)).toEqual([
      ['نصب', 'نصب-1', 'hello-world'],
    ]);
  });

  it('consumes hidden heading slugs to match renderer IDs', () => {
    expect(extractHeadings('# Duplicate\n#### Duplicate\n## Duplicate').map(flattenIds)).toEqual([
      ['duplicate', 'duplicate-2'],
    ]);
  });
});

describe('createHeadingIdPlugin', () => {
  it('assigns matching GitHub IDs to every renderer heading', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse('# Intro\n## Intro\n#### Detail');
    createHeadingIdPlugin()(tree);

    const ids: unknown[] = [];
    visit(tree, 'heading', (node) => ids.push(node.data?.hProperties?.id));

    expect(ids).toEqual(['intro', 'intro-1', 'detail']);
  });
});
