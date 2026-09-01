import { describe, expect, it } from 'vitest';
import { classifyLink } from './links';

describe('classifyLink', () => {
  it.each([
    ['#install', 'fragment'],
    ['https://example.com/docs', 'external'],
    ['HTTP://example.com', 'external'],
    ['mailto:reader@example.com', 'external'],
    ['./guide.md', 'relative'],
    ['images/diagram.png', 'relative'],
    ['../README.md', 'relative'],
    ['javascript:alert(1)', 'unsafe'],
    ['file:///etc/passwd', 'unsafe'],
    ['data:text/html,unsafe', 'unsafe'],
    ['custom:payload', 'unsafe'],
  ] as const)('classifies %s as %s', (href, expected) => {
    expect(classifyLink(href)).toBe(expected);
  });
});
