import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusCard from './StatusCard';

describe('StatusCard', () => {
    it('renders active status', () => {
        render(<StatusCard enabled={true} />);
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Redirects and timers are active.')).toBeInTheDocument();
    });

    it('renders paused status', () => {
        render(<StatusCard enabled={false} />);
        expect(screen.getByText('Paused')).toBeInTheDocument();
        expect(screen.getByText('Blocking is paused.')).toBeInTheDocument();
    });
});
