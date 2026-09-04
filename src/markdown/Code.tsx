import { isValidElement, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { ExtraProps } from 'react-markdown';
import { Icon } from '../components/Icon';

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
type CopyState = 'idle' | 'success' | 'error';

async function copyText(text: string): Promise<boolean> {
  if (window.electronAPI) return window.electronAPI.copyText(text);
  if (!navigator.clipboard) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

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
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  const source = textContent(children);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = async () => {
    clearTimeout(resetTimer.current);

    try {
      const succeeded = await copyText(source);
      setCopyState(succeeded ? 'success' : 'error');
    } catch {
      setCopyState('error');
    }

    resetTimer.current = setTimeout(() => setCopyState('idle'), 1500);
  };

  return (
    <div className="markdown-code-block">
      <button aria-label="Copy code" className="markdown-code-copy" onClick={copy} type="button">
        Copy
      </button>
      {copyState !== 'idle' ? (
        <span
          className="markdown-code-copy-feedback"
          data-state={copyState}
          dir="rtl"
          role="status"
        >
          <Icon name={copyState === 'success' ? 'check' : 'close'} />
          {copyState === 'success' ? 'کپی شد' : 'کپی نشد'}
        </span>
      ) : null}
      <pre {...props}>{children}</pre>
    </div>
  );
}
