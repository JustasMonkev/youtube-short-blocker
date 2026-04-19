import React from 'react';
import StatusCard from './StatusCard';
import { PopupBlockingState } from '../utils/popupStateHelpers';

interface PopupAppProps {
  blockedCount: number;
  blockingState: PopupBlockingState;
  onOpenSettings: () => void;
}

const PopupApp: React.FC<PopupAppProps> = ({ blockedCount, blockingState, onOpenSettings }) => (
  <main className="popup-shell">
    <header className="popup-brand">
      <div className="popup-badge" aria-hidden="true">
        YS
      </div>
      <div className="popup-brand-copy">
        <p className="popup-kicker">YouTube Shorts Blocker</p>
        <h1 className="popup-title">Focused</h1>
      </div>
    </header>

    <section className="popup-stack" aria-label="Popup status">
      <StatusCard
        enabled={blockingState.isActive}
        reason={formatBlockingReason(blockingState.reason)}
        reasonCode={blockingState.reason}
        cooldownMinutesLeft={blockingState.cooldownMinutesLeft}
      />
      <section className="popup-stat" aria-label="Redirects prevented">
        <span className="popup-stat-label">Redirects prevented</span>
        <span className="popup-stat-value">{blockedCount}</span>
      </section>
    </section>

    <button
      type="button"
      onClick={onOpenSettings}
      className="popup-action"
    >
      Open settings
    </button>
  </main>
);

function formatBlockingReason(reason: PopupBlockingState['reason']): string {
  switch (reason) {
    case 'outsideSchedule':
      return 'Blocking paused outside schedule window';
    case 'emergency':
      return 'Emergency mode is enabled';
    case 'cooldown':
      return 'Cooling down';
    case 'disabled':
      return 'Globally disabled';
    default:
      return 'Blocking active';
  }
}

export default PopupApp;
