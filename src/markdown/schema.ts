import { defaultSchema } from 'rehype-sanitize';
import type { Options as Schema } from 'rehype-sanitize';

const attributes = defaultSchema.attributes ?? {};

export const markdownSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...attributes,
    blockquote: [
      ...(attributes.blockquote ?? []),
      [
        'className',
        'markdown-alert',
        'markdown-alert-note',
        'markdown-alert-tip',
        'markdown-alert-important',
        'markdown-alert-warning',
        'markdown-alert-caution',
      ],
      ['dataAlert', 'note', 'tip', 'important', 'warning', 'caution'],
    ],
    code: [...(attributes.code ?? []), ['className', 'hljs', /^language-[\w-]+$/]],
    p: [...(attributes.p ?? []), ['className', 'markdown-alert-title']],
    span: [
      ...(attributes.span ?? []),
      ['className', /^hljs-[\w-]+$/, 'hljs', 'class_', 'language_', 'title'],
    ],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
  strip: [...(defaultSchema.strip ?? []), 'style', 'iframe', 'object', 'embed', 'form'],
};
