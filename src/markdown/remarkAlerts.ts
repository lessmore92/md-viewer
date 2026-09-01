import type { Blockquote, Paragraph, Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

export const alertTypes = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type AlertType = (typeof alertTypes)[number];

const alertMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|\s+|$)/;
const alertTitles: Record<AlertType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

export function isAlertType(value: unknown): value is AlertType {
  return typeof value === 'string' && alertTypes.includes(value as AlertType);
}

function alertTitle(type: AlertType): Paragraph {
  return {
    type: 'paragraph',
    data: { hProperties: { className: ['markdown-alert-title'] } },
    children: [{ type: 'text', value: alertTitles[type] }],
  };
}

function convertBlockquote(node: Blockquote): void {
  const firstParagraph = node.children[0];
  if (firstParagraph?.type !== 'paragraph') return;

  const firstText = firstParagraph.children[0];
  if (firstText?.type !== 'text') return;

  const match = alertMarker.exec(firstText.value);
  if (!match) return;

  const type = match[1].toLowerCase() as AlertType;
  const remainingText = firstText.value.slice(match[0].length);

  if (remainingText) {
    (firstParagraph.children[0] as Text).value = remainingText;
  } else {
    firstParagraph.children.shift();
  }

  node.data = {
    ...(node.data ?? {}),
    hProperties: {
      ...((node.data?.hProperties as Record<string, unknown> | undefined) ?? {}),
      className: ['markdown-alert', `markdown-alert-${type}`],
      dataAlert: type,
    },
  };
  node.children.unshift(alertTitle(type));
}

export default function remarkAlerts(): (tree: Root) => void {
  return (tree) => visit(tree, 'blockquote', convertBlockquote);
}
