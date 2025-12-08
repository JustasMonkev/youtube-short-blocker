import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatsCard from './StatsCard';

describe('StatsCard', () => {
    it('renders blocked count', () => {
        render(<StatsCard blockedCount={42} />);
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Redirects prevented')).toBeInTheDocument();
    });
});
