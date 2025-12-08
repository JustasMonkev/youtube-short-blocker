import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import * as useExtensionStateModule from './hooks/useExtensionState';
import * as useCustomSitesModule from './hooks/useCustomSites';

// Mock hooks to avoid actual storage calls and complex logic in App integration test
// We already tested hooks in isolation.
vi.mock('./hooks/useExtensionState');
vi.mock('./hooks/useCustomSites');

describe('App', () => {
    it('renders all components with hook data', () => {
        // @ts-ignore
        useExtensionStateModule.useExtensionState.mockReturnValue({
            enabled: true,
            blockedCount: 123,
            toggleEnabled: vi.fn(),
            resetBlockedCount: vi.fn(),
        });

        // @ts-ignore
        useCustomSitesModule.useCustomSites.mockReturnValue({
            customSites: [],
            customUrl: '',
            error: '',
            durationMinutes: 0,
            now: Date.now(),
            updateCustomUrl: vi.fn(),
            addSite: vi.fn(),
            removeSite: vi.fn(),
            toggleSite: vi.fn(),
            setDurationMinutes: vi.fn(),
            updateSiteDuration: vi.fn(),
        });

        render(<App />);

        expect(screen.getByText('YouTube Shorts Blocker')).toBeInTheDocument(); // Header
        expect(screen.getByText('Active')).toBeInTheDocument(); // StatusCard
        expect(screen.getByText('Master switch')).toBeInTheDocument(); // ToggleRow
        expect(screen.getByText('123')).toBeInTheDocument(); // StatsCard
        expect(screen.getByText(/redirects YouTube Shorts/)).toBeInTheDocument(); // InfoCard
        expect(screen.getByText('Custom sites & timers')).toBeInTheDocument(); // CustomRulesSection
        expect(screen.getByText('Reset Counter')).toBeInTheDocument(); // ResetButton
    });
});
