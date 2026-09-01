import path from 'node:path';

const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd']);

export function findMarkdownArgument(argv: string[]): string | null {
  return (
    argv.find(
      (argument) =>
        !argument.startsWith('-') && markdownExtensions.has(path.extname(argument).toLowerCase()),
    ) ?? null
  );
}
