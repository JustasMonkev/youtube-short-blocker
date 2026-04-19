import { describe, expect, it } from 'vitest';
import { dedupeCustomSites, exportRulesToText, importRulesFromText } from './ruleTransfer';

describe('rule transfer export/import', () => {
  it('exports a parseable JSON payload', () => {
    const text = exportRulesToText([
      {
        id: 'a1',
        host: 'x.com',
        path: '/shorts',
        label: 'x.com/shorts',
        mode: 'block',
        scope: 'all',
        enabled: true,
        expiresAt: null
      }
    ]);
    const parsed = JSON.parse(text);
    expect(parsed.version).toBe('1.2');
    expect(Array.isArray(parsed.rules)).toBe(true);
    expect(parsed.rules[0]).toMatchObject({
      host: 'x.com',
      mode: 'block'
    });
  });

  it('imports payload wrapper or plain array input', () => {
    const source = JSON.stringify({
      version: '1.2',
      exportedAt: 1,
      rules: [{ host: 'x.com', path: '/shorts', mode: 'block', label: 'x', scope: 'watch', enabled: true }]
    });
    const result = importRulesFromText(source);
    expect(result.errors).toEqual([]);
    expect(result.sites).toEqual([
      {
        id: 'site-0',
        host: 'x.com',
        path: '/shorts',
        label: 'x',
        isProtected: false,
        mode: 'block',
        scope: 'watch',
        enabled: true,
        expiresAt: null
      }
    ]);

    const rawArray = JSON.stringify([{ host: 'x.com', path: '/shorts', mode: 'block', label: 'x', scope: 'watch', enabled: true }]);
    const arrayResult = importRulesFromText(rawArray);
    expect(arrayResult.errors).toEqual([]);
    expect(arrayResult.sites).toHaveLength(1);
  });

  it('removes duplicates and validates input shape', () => {
    const duplicates = [
      { host: 'x.com', path: '/shorts', mode: 'block', scope: 'all', enabled: true },
      { host: 'x.com', path: '/shorts', mode: 'block', scope: 'all', enabled: false }
    ];
    expect(dedupeCustomSites(duplicates as any)).toHaveLength(1);

    const invalid = importRulesFromText('not json');
    expect(invalid.errors).toEqual(['Import content is not valid JSON.']);
    expect(importRulesFromText('').errors).toEqual(['Import content is empty.']);
  });
});
