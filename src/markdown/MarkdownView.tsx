import { createElement, isValidElement, useEffect, useMemo } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { detectDirection } from '../utils/direction';
import { Alert } from './Alert';
import { Code, Pre } from './Code';
import { createHeadingIdPlugin, extractHeadings } from './headings';
import type { HeadingItem } from './headings';
import { Image } from './Image';
import { classifyLink, isDataImage } from './links';
import remarkAlerts, { isAlertType } from './remarkAlerts';
import { markdownSchema } from './schema';
import { scrollToHeading } from './navigation';

export interface MarkdownViewProps {
  content: string;
  documentId: string | null;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  onNavigate?: (id: string) => void;
}

function textContent(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textContent).join('');
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return textContent(children.props.children);
  }
  return '';
}

function withoutNode<Props extends ExtraProps>(props: Props): Omit<Props, 'node'> {
  const result = { ...props };
  delete result.node;
  return result;
}

type BidiTag = 'p' | 'li' | 'td' | 'th';

function bidiComponent<Tag extends BidiTag>(Tag: Tag) {
  return function BidiComponent(props: ComponentPropsWithoutRef<Tag> & ExtraProps) {
    const domProps = withoutNode(props);
    return createElement(Tag as ElementType, {
      ...domProps,
      dir: domProps.dir ?? detectDirection(textContent(domProps.children)),
    });
  };
}

function collectHeadingIds(content: string): Map<number, string> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(content);
  createHeadingIdPlugin()(tree);
  const ids = new Map<number, string>();

  visit(tree, 'heading', (node) => {
    const offset = node.position?.start.offset;
    const id = node.data?.hProperties?.id;
    if (typeof offset === 'number' && typeof id === 'string') ids.set(offset, id);
  });

  return ids;
}

function headingComponent<Tag extends 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>(
  Tag: Tag,
  headingIds: Map<number, string>,
) {
  return function Heading(props: ComponentPropsWithoutRef<Tag> & ExtraProps) {
    const domProps = withoutNode(props);
    const offset = props.node?.position?.start.offset;
    const generatedId = typeof offset === 'number' ? headingIds.get(offset) : undefined;

    return createElement(Tag, {
      ...domProps,
      dir: domProps.dir ?? detectDirection(textContent(domProps.children)),
      id: generatedId ?? domProps.id,
    });
  };
}

function fragmentId(href: string): string {
  const value = href.slice(1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createComponents(
  documentId: string | null,
  headingIds: Map<number, string>,
  onNavigate: (id: string) => void,
): Components {
  const Paragraph = bidiComponent('p');
  const ListItem = bidiComponent('li');
  const TableData = bidiComponent('td');
  const TableHeader = bidiComponent('th');

  return {
    a(props) {
      const domProps = withoutNode(props);
      const href = typeof props.href === 'string' ? props.href.trim() : '';
      const kind = href ? classifyLink(href) : 'unsafe';
      const safeHref = kind === 'fragment' || kind === 'external' ? href : undefined;

      return (
        <a
          {...domProps}
          href={safeHref}
          onClick={(event) => {
            props.onClick?.(event);
            if (event.defaultPrevented) return;

            if (kind === 'fragment') {
              event.preventDefault();
              onNavigate(fragmentId(href));
            } else if (kind === 'external') {
              event.preventDefault();
              void window.electronAPI.openExternal(href);
            } else if (kind === 'relative' || kind === 'unsafe') {
              event.preventDefault();
            }
          }}
        />
      );
    },
    blockquote(props) {
      const domProps = withoutNode(props);
      const alertType = props.node?.properties.dataAlert;
      if (isAlertType(alertType)) {
        return <Alert {...domProps} type={alertType} />;
      }
      return (
        <blockquote
          {...domProps}
          dir={domProps.dir ?? detectDirection(textContent(domProps.children))}
        />
      );
    },
    code: Code,
    h1: headingComponent('h1', headingIds),
    h2: headingComponent('h2', headingIds),
    h3: headingComponent('h3', headingIds),
    h4: headingComponent('h4', headingIds),
    h5: headingComponent('h5', headingIds),
    h6: headingComponent('h6', headingIds),
    img(props) {
      return <Image {...props} documentId={documentId} />;
    },
    li: ListItem,
    p: Paragraph,
    pre: Pre,
    td: TableData,
    th: TableHeader,
  };
}

function markdownUrlTransform(value: string, key: string): string {
  if (key === 'src' && isDataImage(value)) return value;
  return defaultUrlTransform(value);
}

export function MarkdownView({
  content,
  documentId,
  onHeadingsChange,
  onNavigate = scrollToHeading,
}: MarkdownViewProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const headingIds = useMemo(() => collectHeadingIds(content), [content]);
  const components = useMemo(
    () => createComponents(documentId, headingIds, onNavigate),
    [documentId, headingIds, onNavigate],
  );

  useEffect(() => {
    onHeadingsChange?.(headings);
  }, [headings, onHeadingsChange]);

  return (
    <ReactMarkdown
      components={components}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSchema], rehypeHighlight]}
      remarkPlugins={[remarkGfm, remarkAlerts, createHeadingIdPlugin]}
      urlTransform={markdownUrlTransform}
    >
      {content}
    </ReactMarkdown>
  );
}
