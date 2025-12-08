import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResetButton from './ResetButton';

describe('ResetButton', () => {
    it('renders button and handles click', () => {
        const onReset = vi.fn();
        render(<ResetButton onReset={onReset} />);

        const button = screen.getByText('Reset Counter');
        expect(button).toBeInTheDocument();

        fireEvent.click(button);
        expect(onReset).toHaveBeenCalled();
    });
});
