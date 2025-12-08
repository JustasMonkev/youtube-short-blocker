import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ToggleRow from './ToggleRow';

// Mock ToggleSwitch to isolate testing
vi.mock('./ToggleSwitch', () => ({
    default: ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
        <input
            type="checkbox"
            data-testid="mock-toggle"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
        />
    )
}));

describe('ToggleRow', () => {
    it('renders and handles toggle', () => {
        const onToggle = vi.fn();
        render(<ToggleRow enabled={true} onToggle={onToggle} />);

        expect(screen.getByText('Master switch')).toBeInTheDocument();
        const toggle = screen.getByTestId('mock-toggle');
        expect(toggle).toBeChecked();

        fireEvent.click(toggle);
        expect(onToggle).toHaveBeenCalledWith(false);
    });
});
