import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '*.config.js',
        '**/*.d.ts',
        'src/tests/setup.ts',
        'src/types/**',
        'e2e/**',
        '**/e2e/**'
      ],
      include: ['src/**/*.{ts,tsx}']
    },
    exclude: [
      '**/node_modules/**',
      'dist/**',
      'e2e/**',
      '**/e2e/**',
      '.git/**',
      '.idea/**',
      '.vscode/**'
    ],
  },
});
