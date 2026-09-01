import type { BlockquoteHTMLAttributes, ReactNode } from 'react';
import type { AlertType } from './remarkAlerts';

const alertIcons: Record<AlertType, string> = {
  note: 'ⓘ',
  tip: '◆',
  important: '❕',
  warning: '▲',
  caution: '⛔',
};

interface AlertProps extends BlockquoteHTMLAttributes<HTMLQuoteElement> {
  children?: ReactNode;
  type: AlertType;
}

export function Alert({ children, className, type, ...props }: AlertProps) {
  const classes = new Set(
    ['markdown-alert', `markdown-alert-${type}`, ...(className?.split(/\s+/) ?? [])].filter(
      Boolean,
    ),
  );

  return (
    <blockquote {...props} className={[...classes].join(' ')} data-alert={type}>
      <span aria-hidden="true" className="markdown-alert-icon">
        {alertIcons[type]}
      </span>
      {children}
    </blockquote>
  );
}
