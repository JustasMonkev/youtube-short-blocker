import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from './Header';

describe('Header', () => {
    it('renders header text', () => {
        render(<Header />);
        expect(screen.getByText('YouTube Shorts Blocker')).toBeInTheDocument();
        expect(screen.getByText(/Stay focused/)).toBeInTheDocument();
        expect(screen.getByText('⏳')).toBeInTheDocument();
    });
});
