// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface PackageConfig {
  build?: {
    directories?: { buildResources?: string; output?: string };
    fileAssociations?: Array<{ ext: string | string[]; icon?: string }>;
    win?: { icon?: string };
  };
  scripts?: { 'electron:build'?: string };
}

describe('electron-builder configuration', () => {
  it('registers every Markdown extension accepted by the application', async () => {
    const packageConfig = JSON.parse(await readFile('package.json', 'utf8')) as PackageConfig;
    const extensions = (packageConfig.build?.fileAssociations ?? []).flatMap(({ ext }) => ext);

    expect(extensions).toEqual(['md', 'markdown', 'mdown', 'mkd']);
  });

  it('generates the executable icon from the tracked PNG and uses it for associations', async () => {
    const packageConfig = JSON.parse(await readFile('package.json', 'utf8')) as PackageConfig;

    expect(packageConfig.build?.directories).toEqual({
      buildResources: 'build',
      output: 'release',
    });
    expect(packageConfig.build?.win?.icon).toBe('build/icon.ico');
    expect(packageConfig.build?.fileAssociations?.every(({ icon }) => icon === undefined)).toBe(
      true,
    );
    expect(packageConfig.scripts?.['electron:build']).toContain('npm run generate:windows-icon');
  });
});
