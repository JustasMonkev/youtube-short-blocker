import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomRuleItem from './CustomRuleItem';
import { CustomSite } from '../../../types';

describe('CustomRuleItem', () => {
    let defaultProps: any;

    beforeEach(() => {
        vi.clearAllMocks();
        defaultProps = {
            site: { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: null, label: 'example.com' } as CustomSite,
            now: Date.now(),
            durationOptions: [{ label: '1h', value: 60 }],
            onToggle: vi.fn(),
            onRemove: vi.fn(),
            onDurationChange: vi.fn(),
        };
    });

    it('resets select value after change', () => {
        render(<CustomRuleItem {...defaultProps} />);

        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('');

        fireEvent.change(select, { target: { value: '60' } });

        expect(defaultProps.onDurationChange).toHaveBeenCalledWith(60);
        expect(select).toHaveValue('');
    });

    it('ignores non-numeric select value', () => {
        // Pass an option with non-numeric value to simulate invalid input
        const props = { ...defaultProps, durationOptions: [{ label: 'Invalid', value: 'nan' as any }] };
        render(<CustomRuleItem {...props} />);
        const select = screen.getByRole('combobox');

        fireEvent.change(select, { target: { value: 'nan' } });

        expect(defaultProps.onDurationChange).not.toHaveBeenCalled();
    });

    it('formats time left correctly (minutes)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 30 * 60000 }; // 30m
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('30m left')).toBeInTheDocument();
    });

    it('formats time left correctly (hours)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 120 * 60000 }; // 2h
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('2h left')).toBeInTheDocument();
    });

    it('formats time left correctly (hours and minutes)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 150 * 60000 }; // 2h 30m
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('2h 30m left')).toBeInTheDocument();
    });

    it('formats time left correctly (days)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 24 * 60 * 60000 }; // 1d
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('1d left')).toBeInTheDocument();
    });

    it('formats time left correctly (days and hours)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 26 * 60 * 60000 }; // 1d 2h
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('1d 2h left')).toBeInTheDocument();
    });

    it('formats time left correctly (minutes < 1)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now + 30000 }; // 0.5m
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('1m left')).toBeInTheDocument();
    });

    it('formats time left correctly (timer ended)', () => {
        const site = { ...defaultProps.site, expiresAt: defaultProps.now - 1000 };
        render(<CustomRuleItem {...defaultProps} site={site} />);
        expect(screen.getByText('Timer ended')).toBeInTheDocument();
    });

    it('renders all quick duration buttons correctly', () => {
        render(<CustomRuleItem {...defaultProps} />);
        expect(screen.getByRole('button', { name: '15m' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1h' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '4h' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '1d' })).toBeInTheDocument();
    });
});
