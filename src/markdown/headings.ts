import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

export interface HeadingItem {
  id: string;
  depth: 1 | 2 | 3;
  text: string;
  children: HeadingItem[];
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const slugger = new GithubSlugger();
  const headings: HeadingItem[] = [];
  const ancestors: HeadingItem[] = [];

  visit(tree, 'heading', (node) => {
    const text = toString(node, { includeHtml: false });
    const id = slugger.slug(text);

    if (node.depth !== 1 && node.depth !== 2 && node.depth !== 3) {
      return;
    }

    const item: HeadingItem = {
      id,
      depth: node.depth,
      text,
      children: [],
    };

    while (ancestors.length > 0 && ancestors[ancestors.length - 1].depth >= item.depth) {
      ancestors.pop();
    }

    const parent = ancestors[ancestors.length - 1];
    if (parent) {
      parent.children.push(item);
    } else {
      headings.push(item);
    }

    ancestors.push(item);
  });

  return headings;
}

export function createHeadingIdPlugin(): (tree: Root) => void {
  return (tree) => {
    const slugger = new GithubSlugger();

    visit(tree, 'heading', (node) => {
      const data = (node.data ?? {}) as Record<string, unknown>;
      const hProperties = (data.hProperties ?? {}) as Record<string, unknown>;

      data.hProperties = {
        ...hProperties,
        id: slugger.slug(toString(node, { includeHtml: false })),
      };
      node.data = data;
    });
  };
}
