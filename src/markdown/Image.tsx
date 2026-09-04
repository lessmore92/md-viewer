import { useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import type { ExtraProps } from 'react-markdown';
import { classifyLink, isDataImage } from './links';

type ImageProps = ComponentPropsWithoutRef<'img'> &
  ExtraProps & {
    documentId: string | null;
  };

function isRemoteImage(source: string): boolean {
  return /^https?:/i.test(source);
}

export function Image(input: ImageProps) {
  const safeProps = { ...input };
  delete safeProps.node;
  const { alt = '', documentId, onError, src = '', ...props } = safeProps;
  const originalSource = String(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  let resolvedSource: string | null = null;
  if (isRemoteImage(originalSource) || isDataImage(originalSource)) {
    resolvedSource = originalSource;
  } else if (documentId && classifyLink(originalSource) === 'relative') {
    try {
      resolvedSource = window.electronAPI?.assetUrl(documentId, originalSource) ?? null;
    } catch {
      resolvedSource = null;
    }
  }

  if (!resolvedSource || failedSource === resolvedSource) {
    return (
      <span className="markdown-image-fallback" role="status">
        Image unavailable: {originalSource || alt}
      </span>
    );
  }

  return (
    <img
      {...props}
      alt={alt}
      src={resolvedSource}
      onError={(event) => {
        onError?.(event);
        setFailedSource(resolvedSource);
      }}
    />
  );
}
