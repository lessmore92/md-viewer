import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { detectDirection } from '../utils/direction';

interface MarkdownProps {
  content: string;
}

function getText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(getText).join('');
  if (node && typeof node === 'object' && 'props' in node && node.props?.children) {
    return getText(node.props.children);
  }
  return '';
}

const bidiComponent = (Tag: any, extraClassName = '') =>
  function BidiComponent(props: any) {
    const children = props.children;
    const text = getText(children);
    const dir = detectDirection(text);
    return (
      <Tag {...props} dir={dir} className={[extraClassName, props.className].filter(Boolean).join(' ') || undefined}>
        {children}
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
