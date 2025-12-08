import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomRulesSection from './CustomRulesSection';
import { CustomSite } from '../../../types';

describe('CustomRulesSection Integration', () => {
    const defaultProps = {
        customUrl: '',
        durationMinutes: 0,
        error: '',
        now: Date.now(),
        sites: [],
        onUrlChange: vi.fn(),
        onDurationChange: vi.fn(),
        onSubmit: vi.fn(),
        onToggleSite: vi.fn(),
        onRemoveSite: vi.fn(),
        onUpdateDuration: vi.fn(),
    };

    it('renders empty list state', () => {
        render(<CustomRulesSection {...defaultProps} />);
        expect(screen.getByText(/Block entire sites/)).toBeInTheDocument();
        expect(screen.getByText('No custom sites yet. Try x.com, tiktok.com, or reddit.com.')).toBeInTheDocument();
    });

    it('renders form and handles input', () => {
        render(<CustomRulesSection {...defaultProps} customUrl="test.com" durationMinutes={15} />);

        const input = screen.getByLabelText('Website to block');
        expect(input).toHaveValue('test.com');

        fireEvent.change(input, { target: { value: 'new.com' } });
        expect(defaultProps.onUrlChange).toHaveBeenCalledWith('new.com');

        const select = screen.getByLabelText('Block duration');
        expect(select).toHaveValue('15');

        fireEvent.change(select, { target: { value: '60' } });
        expect(defaultProps.onDurationChange).toHaveBeenCalledWith(60);
    });

    it('submits form', () => {
        render(<CustomRulesSection {...defaultProps} customUrl="foo.com" />);
        const button = screen.getByText('Add to blocklist');
        fireEvent.click(button);
        expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    it('renders error message', () => {
        render(<CustomRulesSection {...defaultProps} error="Invalid site" />);
        expect(screen.getByText('Invalid site')).toBeInTheDocument();
    });

    it('renders sites list', () => {
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: null },
            { id: '2', host: 'foo.com', mode: 'disable_js', enabled: false, expiresAt: null }
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} />);

        expect(screen.getByText('example.com (all pages)')).toBeInTheDocument();
        expect(screen.getByText('Blocked')).toBeInTheDocument();

        expect(screen.getByText('foo.com (all pages)')).toBeInTheDocument();
        expect(screen.getByText('JS disabled')).toBeInTheDocument();
    });

    it('handles site actions', () => {
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: null }
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} />);

        // Toggle
        const toggle = screen.getAllByRole('checkbox')[0]; // First checkbox (there might be one in form? No form doesn't use checkbox)
        // Checkboxes in CustomRuleItem use ToggleSwitch which has input type checkbox
        fireEvent.click(toggle);
        expect(defaultProps.onToggleSite).toHaveBeenCalledWith('1', false);

        // Remove
        const removeBtn = screen.getByLabelText('Remove example.com');
        fireEvent.click(removeBtn);
        expect(defaultProps.onRemoveSite).toHaveBeenCalledWith('1');
    });

    it('handles timer updates', () => {
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: null }
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} />);

        // Quick button 15m
        const btn15m = screen.getByText('15m');
        fireEvent.click(btn15m);
        expect(defaultProps.onUpdateDuration).toHaveBeenCalledWith('1', 15);

        // Clear timer
        const clearBtn = screen.getByText('Clear timer');
        fireEvent.click(clearBtn);
        expect(defaultProps.onUpdateDuration).toHaveBeenCalledWith('1', 0);

        // Select 'More...'
        // Find select by default value?
        // The select has "More..." option disabled and selected by default.
        // We can find by display value? No, "More..." is option text.
        // Use container query or role.
        const selects = screen.getAllByRole('combobox');
        // First one is in form (Block duration).
        // Second one is in item.
        const itemSelect = selects[1];
        fireEvent.change(itemSelect, { target: { value: '240' } });
        expect(defaultProps.onUpdateDuration).toHaveBeenCalledWith('1', 240);

        // Ensure it resets
        // expect(itemSelect).toHaveValue(''); // defaultValue is "", controlled by onDurationChange? No, it's uncontrolled logic inside item.
    });

    it('displays time left', () => {
        const now = 100000;
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: now + 60000 * 10 } // 10 mins left
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} now={now} />);
        expect(screen.getByText('10m left')).toBeInTheDocument();
    });

    it('displays time left variants', () => {
        const now = 100000;
        const sites: CustomSite[] = [
             { id: '1', host: 'a.com', enabled: true, mode: 'block', expiresAt: now - 1000 }, // ended
             { id: '2', host: 'b.com', enabled: true, mode: 'block', expiresAt: now + 60000 * 90 }, // 1h 30m
             { id: '3', host: 'c.com', enabled: true, mode: 'block', expiresAt: now + 60000 * 60 * 25 }, // 25h -> 1d 1h
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} now={now} />);

        expect(screen.getByText('Timer ended')).toBeInTheDocument();
        expect(screen.getByText('1h 30m left')).toBeInTheDocument();
        expect(screen.getByText('1d 1h left')).toBeInTheDocument();
    });

    it('renders path specific label', () => {
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', path: '/shorts', mode: 'block', enabled: true, expiresAt: null }
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} />);
        expect(screen.getByText('example.com/shorts')).toBeInTheDocument();
    });

    it('renders 1 day quick button', () => {
        const sites: CustomSite[] = [
            { id: '1', host: 'example.com', mode: 'block', enabled: true, expiresAt: null }
        ];
        render(<CustomRulesSection {...defaultProps} sites={sites} />);
        expect(screen.getByText('1d')).toBeInTheDocument();
    });
});
