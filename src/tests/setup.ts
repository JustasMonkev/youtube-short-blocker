import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome API
const chromeMock = {
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    lastError: undefined,
  },
  storage: {
    sync: {
      get: vi.fn((keys, callback) => callback({})),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  webNavigation: {
    onHistoryStateUpdated: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    update: vi.fn(),
  },
  declarativeNetRequest: {
    updateDynamicRules: vi.fn((options, callback) => {
        if (callback) callback();
    }),
    RuleActionType: {
      BLOCK: 'block',
    },
    ResourceType: {
      MAIN_FRAME: 'main_frame',
      XMLHTTPREQUEST: 'xmlhttprequest',
      STYLESHEET: 'stylesheet',
      SUB_FRAME: 'sub_frame',
    },
  },
};

global.chrome = chromeMock as any;

// Mock window.location for content scripts
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost/',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});
