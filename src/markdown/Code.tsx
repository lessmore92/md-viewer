import { isValidElement, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';

function textContent(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textContent).join('');
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return textContent(children.props.children);
  }
  return '';
}

type CodeProps = ComponentPropsWithoutRef<'code'> & ExtraProps;
type PreProps = ComponentPropsWithoutRef<'pre'> & ExtraProps;

export function Code(input: CodeProps) {
  const safeProps = { ...input };
  delete safeProps.node;
  const { children, className, ...props } = safeProps;
  const source = textContent(children);
  const isBlock = Boolean(className?.includes('language-') || source.includes('\n'));

  return (
    <code {...props} className={className} dir="ltr" data-code-block={isBlock || undefined}>
      {children}
    </code>
  );
}

export function Pre(input: PreProps) {
  const safeProps = { ...input };
  delete safeProps.node;
  const { children, ...props } = safeProps;
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  const source = textContent(children);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async () => {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="markdown-code-block">
      <button aria-label="Copy code" className="markdown-code-copy" onClick={copy} type="button">
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}
