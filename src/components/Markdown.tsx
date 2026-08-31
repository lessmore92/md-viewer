import React, { Fragment, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { detectDirection } from '../utils/direction';

interface MarkdownProps {
  content: string;
}

function getText(node: ReactNode): string {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as any;
    return getText(props?.children);
  }
  return '';
}

function containsNewline(nodes: ReactNode): boolean {
  return /\n/.test(getText(nodes));
}

// Split rich children into lines, preserving inline elements (bold, links, code).
function splitLines(nodes: ReactNode): ReactNode[][] {
  const lines: ReactNode[][] = [[]];
  const pushRemainder = (text: string) => {
    const parts = text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1].push(part);
    });
  };

  React.Children.forEach(nodes, (child) => {
    if (typeof child === 'string') {
      pushRemainder(child);
    } else if (typeof child === 'number') {
      lines[lines.length - 1].push(child);
    } else if (React.isValidElement(child)) {
      const childText = getText(child);
      if (/\n/.test(childText)) {
        const open = React.cloneElement(child, {
          children: splitLines((child.props as any).children).flat()
        });
        lines[lines.length - 1].push(open);
      } else {
        lines[lines.length - 1].push(child);
      }
    }
  });

  return lines;
}

function Line({ children }: { children: ReactNode }) {
  const dir = detectDirection(getText(children));
  return <span dir={dir}>{children}</span>;
}

function BidiText({ children }: { children: ReactNode }) {
  const lines = splitLines(children);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Line>{line}</Line>
        </Fragment>
      ))}
    </>
  );
}

const bidiComponent = (Tag: any, extraClassName = '') =>
  function BidiComponent(props: any) {
    const children = props.children;
    if (!containsNewline(children)) {
      const dir = detectDirection(getText(children));
      return (
        <Tag {...props} dir={dir} className={[extraClassName, props.className].filter(Boolean).join(' ') || undefined}>
          {children}
        </Tag>
      );
    }
    return (
      <Tag {...props} className={[extraClassName, props.className].filter(Boolean).join(' ') || undefined}>
        <BidiText>{children}</BidiText>
      </Tag>
    );
  };

const Paragraph = bidiComponent('p');
const Heading = ({ level, ...rest }: any) => bidiComponent(`h${level}`)(rest);
const ListItem = bidiComponent('li');
const Blockquote = bidiComponent('blockquote');
const TableCell = bidiComponent('td');

const CodeBlock = function CodeBlock(props: any) {
  const { inline, className, children } = props;
  if (inline) {
    return <code className={className} dir="ltr">{children}</code>;
  }
  return (
    <pre dir="ltr">
      <code className={className}>{children}</code>
    </pre>
  );
};

const components = {
  p: Paragraph,
  h1: Heading as any,
  h2: Heading as any,
  h3: Heading as any,
  h4: Heading as any,
  h5: Heading as any,
  h6: Heading as any,
  li: ListItem,
  blockquote: Blockquote,
  td: TableCell,
  th: TableCell,
  code: CodeBlock
};

export default function Markdown({ content }: MarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
