import { describe, expect, it } from 'vitest';
import webpackConfig from '../webpack.config';

describe('webpack popup and settings split', () => {
  it('preserves popup.html as the action popup', async () => {
    const plugins = (webpackConfig as { plugins?: unknown[] }).plugins || [];
    const copyPlugin = plugins.find(
      (candidate: unknown) => (candidate as { constructor?: { name?: string } }).constructor?.name === 'CopyPlugin'
    );

    expect(copyPlugin).toBeTruthy();

    const patterns = (copyPlugin as { patterns?: unknown[] }).patterns || [];
    const manifestPattern = patterns.find(
      (pattern: { from?: string }) => pattern.from === 'manifest.json'
    );

    expect(manifestPattern).toBeDefined();

    const transformResult = await Promise.resolve(
      (manifestPattern as { transform: (content: Buffer) => Buffer | string }).transform(
        Buffer.from(
          JSON.stringify({
            background: { service_worker: 'background.js' },
            action: { default_popup: 'popup.html' }
          })
        )
      )
    );

    const transformedManifestText =
      typeof transformResult === 'string' ? transformResult : transformResult.toString();
    const transformedManifest = JSON.parse(transformedManifestText);

    expect(transformedManifest).toMatchObject({
      background: { service_worker: 'background.js' },
      action: { default_popup: 'popup.html' }
    });
  });

  it('emits a dedicated settings entry and html page', () => {
    const entries = (webpackConfig as { entry?: Record<string, string> }).entry || {};

    expect(entries).toMatchObject({
      popup: './src/popup/index.tsx',
      settings: './src/settings/index.tsx'
    });

    const plugins = (webpackConfig as { plugins?: unknown[] }).plugins || [];
    const htmlPlugins = plugins.filter(
      (candidate: unknown) => (candidate as { constructor?: { name?: string } }).constructor?.name === 'HtmlWebpackPlugin'
    ) as Array<{ userOptions?: { filename?: string; chunks?: string[] } }>;

    expect(htmlPlugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userOptions: expect.objectContaining({
            filename: 'popup.html',
            chunks: ['popup']
          })
        }),
        expect.objectContaining({
          userOptions: expect.objectContaining({
            filename: 'settings.html',
            chunks: ['settings']
          })
        })
      ])
    );
  });
});
