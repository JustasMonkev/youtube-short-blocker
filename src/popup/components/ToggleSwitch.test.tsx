import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ToggleSwitch from './ToggleSwitch';

describe('ToggleSwitch', () => {
    it('renders and handles click', () => {
        const onChange = vi.fn();
        render(<ToggleSwitch checked={false} onChange={onChange} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('renders checked state', () => {
        const onChange = vi.fn();
        render(<ToggleSwitch checked={true} onChange={onChange} />);

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('renders small variant', () => {
        render(<ToggleSwitch checked={false} onChange={vi.fn()} small />);
        // Testing style classes is brittle but coverage requires executing the branch.
        // We just need to ensure it renders without error.
        const label = screen.getByRole('checkbox').parentElement;
        expect(label).toHaveClass('w-9 h-5');
    });

    it('renders checked small variant', () => {
        render(<ToggleSwitch checked={true} onChange={vi.fn()} small />);
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });
});
