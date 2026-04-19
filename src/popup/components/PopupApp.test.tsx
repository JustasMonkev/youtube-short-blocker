import React, { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PopupApp from './PopupApp';

describe('PopupApp', () => {
  it('renders the compact branded popup shell', () => {
    const html = renderToStaticMarkup(
      <PopupApp
        blockedCount={12}
        blockingState={{
          isActive: true,
          isEnabled: true,
          isEmergency: false,
          isInCooldown: false,
          isWithinSchedule: true,
          cooldownMinutesLeft: null,
          reason: 'active'
        }}
        onOpenSettings={vi.fn()}
      />
    );

    expect(html).toContain('YouTube Shorts Blocker');
    expect(html).toContain('Focused');
    expect(html).toContain('Global status');
    expect(html).toContain('Redirects prevented');
    expect(html).toContain('Open settings');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.toLowerCase()).not.toContain('custom sites');
    expect(html).not.toContain('Diagnostics');
    expect(html).not.toContain('Daily redirect summary');
  });

  it('preserves cooldown detail in the status display', () => {
    const html = renderToStaticMarkup(
      <PopupApp
        blockedCount={7}
        blockingState={{
          isActive: false,
          isEnabled: true,
          isEmergency: false,
          isInCooldown: true,
          isWithinSchedule: true,
          cooldownMinutesLeft: 5,
          reason: 'cooldown'
        }}
        onOpenSettings={vi.fn()}
      />
    );

    expect(html).toContain('Cooling down');
    expect(html).toContain('5m left');
  });

  it('wires the open settings button to the provided callback', () => {
    const onOpenSettings = vi.fn();

    const tree = PopupApp({
      blockedCount: 3,
      blockingState: {
        isActive: true,
        isEnabled: true,
        isEmergency: false,
        isInCooldown: false,
        isWithinSchedule: true,
        cooldownMinutesLeft: null,
        reason: 'active'
      },
      onOpenSettings
    }) as ReactElement;

    const button = findButton(tree);

    expect(button).toBeTruthy();
    button!.props.onClick!();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

function findButton(node: ReactNode): ReactElement<{ children?: ReactNode; onClick?: () => void }> | null {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findButton(child);
      if (match) {
        return match;
      }
    }
    return null;
  }

  if (!React.isValidElement(node)) {
    return null;
  }

  if (node.type === 'button') {
    return node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
  }

  const props = node.props as { children?: ReactNode };
  return findButton(props.children);
}
