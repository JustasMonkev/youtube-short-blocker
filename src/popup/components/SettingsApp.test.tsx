import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SettingsApp from './SettingsApp';

describe('SettingsApp', () => {
  it('renders the richer dashboard sections', () => {
    const html = renderToStaticMarkup(
      <SettingsApp
        extensionState={{
          blockedCount: 12,
          blockedCountByDay: {},
          blockingState: {
            isActive: true,
            isEnabled: true,
            isEmergency: false,
            isInCooldown: false,
            isWithinSchedule: true,
            cooldownMinutesLeft: null,
            reason: 'active'
          },
          globalCooldownUntil: null,
          emergencyMode: false,
          scheduleWindow: null,
          shortActivitySummary: {
            blockedTotal: 0,
            lastBlockedAt: null,
            whitelistSkips: 0,
            cooldownSkips: 0,
            scheduleSkips: 0
          },
          blockingDiagnostics: {
            lastCheckedAt: null,
            lastCheckedUrl: null,
            lastDecision: 'allowed',
            lastReason: 'disabled',
            activeRules: 0
          },
          permissionHealth: {
            checked: true,
            permissionsApiAvailable: true,
            missingPermissions: [],
            missingOrigins: [],
            error: null
          },
          storageHealth: {
            checked: true,
            healthy: true,
            error: null
          },
          isInCooldown: false,
          setCooldown: vi.fn(),
          toggleEmergencyMode: vi.fn(),
          updateScheduleWindow: vi.fn(),
          refreshHealth: vi.fn()
        }}
        customSitesState={{
          customSites: [],
          customUrl: '',
          error: '',
          durationMinutes: 0,
          customMode: 'block',
          customScope: 'all',
          now: 0,
          updateCustomUrl: vi.fn(),
          addSite: vi.fn(),
          removeSite: vi.fn(),
          toggleSite: vi.fn(),
          setDurationMinutes: vi.fn(),
          setCustomMode: vi.fn(),
          setCustomScope: vi.fn(),
          updateSiteDuration: vi.fn(),
          updateSiteMode: vi.fn(),
          updateSiteScope: vi.fn(),
          exportSites: vi.fn(),
          importSites: vi.fn()
        }}
      />
    );

    expect(html).toContain('Custom sites');
    expect(html).toContain('Daily redirect summary');
    expect(html).toContain('Diagnostics');
    expect(html).toContain('Global controls');
  });
});
