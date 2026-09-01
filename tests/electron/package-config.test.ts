// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface PackageConfig {
  build?: {
    fileAssociations?: Array<{ ext: string | string[] }>;
  };
}

describe('electron-builder configuration', () => {
  it('registers every Markdown extension accepted by the application', async () => {
    const packageConfig = JSON.parse(await readFile('package.json', 'utf8')) as PackageConfig;
    const extensions = (packageConfig.build?.fileAssociations ?? []).flatMap(({ ext }) => ext);

    expect(extensions).toEqual(['md', 'markdown', 'mdown', 'mkd']);
  });
});
