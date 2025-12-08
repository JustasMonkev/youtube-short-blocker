import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InfoCard from './InfoCard';

describe('InfoCard', () => {
    it('renders info text', () => {
        render(<InfoCard />);
        expect(screen.getByText(/redirects YouTube Shorts/)).toBeInTheDocument();
        expect(screen.getByText(/Set a timer/)).toBeInTheDocument();
    });
});
