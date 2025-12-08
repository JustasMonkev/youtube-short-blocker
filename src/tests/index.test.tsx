import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock ReactDOM
const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock('react-dom/client', () => ({
    default: {
        createRoot: createRootMock,
    },
}));

// Mock App
vi.mock('../popup/App', () => ({
    default: () => <div>App</div>,
}));

describe('index.tsx', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '<div id="root"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.resetModules();
    });

    it('renders App into root', async () => {
        await import('../popup/index');

        expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
        expect(renderMock).toHaveBeenCalled();
    });
});
