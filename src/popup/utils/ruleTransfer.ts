import { CustomSite } from '../../types';
import { sanitizeSites } from './siteHelpers';

export interface RuleTransferResult {
  sites: CustomSite[];
  errors: string[];
}

const EXPORT_VERSION = '1.2';
const EXPORT_MIME_TYPE = 'application/json';

export interface RuleExportPayload {
  version: string;
  exportedAt: number;
  rules: CustomSite[];
}

export function getRuleExportMimeType(): string {
  return EXPORT_MIME_TYPE;
}

export function getRuleExportFilename(): string {
  return 'youtube-shorts-blocker-rules.json';
}

export function exportRulesToText(sites: CustomSite[]): string {
  const payload: RuleExportPayload = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    rules: sites.map(({ id, ...site }) => ({
      ...site,
      id
    }))
  };

  return JSON.stringify(payload, null, 2);
}

export function importRulesFromText(raw: string): RuleTransferResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      sites: [],
      errors: ['Import content is empty.']
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      sites: [],
      errors: ['Import content is not valid JSON.']
    };
  }

  const records = extractRuleRecords(parsed);
  if (!records.length) {
    return {
      sites: [],
      errors: ['No rule data found in import file.']
    };
  }

  const deduped = dedupeCustomSites(sanitizeSites(records));
  if (!deduped.length) {
    return {
      sites: [],
      errors: ['No valid rules found in import file.']
    };
  }

  return {
    sites: deduped,
    errors: []
  };
}

export function dedupeCustomSites(sites: CustomSite[]): CustomSite[] {
  const seen = new Set<string>();
  const out: CustomSite[] = [];

  for (const site of sites) {
    const key = `${site.host}|${site.path}|${site.mode}|${site.scope || 'all'}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(site);
  }

  return out;
}

function extractRuleRecords(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const candidate = raw as { rules?: unknown };
  if (!Array.isArray(candidate.rules)) {
    return [];
  }

  return candidate.rules;
}
