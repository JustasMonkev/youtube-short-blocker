import React from 'react';
import { BlockingDiagnostics, ShortActivitySummary } from '../../types';
import { PopupBlockingState } from '../utils/popupStateHelpers';

interface PermissionHealth {
  checked: boolean;
  permissionsApiAvailable: boolean;
  missingPermissions: string[];
  missingOrigins: string[];
  error: string | null;
}

interface StorageHealth {
  checked: boolean;
  healthy: boolean;
  error: string | null;
}

interface DiagnosticsCardProps {
  blockingState: PopupBlockingState;
  shortActivitySummary: ShortActivitySummary;
  blockingDiagnostics: BlockingDiagnostics;
  permissionHealth: PermissionHealth;
  storageHealth: StorageHealth;
}

const DiagnosticsCard: React.FC<DiagnosticsCardProps> = ({
  blockingState,
  shortActivitySummary,
  blockingDiagnostics,
  permissionHealth,
  storageHealth
}) => {
  const permissionLabel =
    permissionHealth.missingPermissions.length || permissionHealth.missingOrigins.length || !permissionHealth.permissionsApiAvailable
      ? 'Degraded'
      : 'Healthy';

  return (
    <section className="p-4 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Diagnostics</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Current health and active-state checks.</p>
      </div>
      <div className="grid gap-3 text-xs text-gray-700 dark:text-gray-300">
        <div className="flex items-center justify-between">
          <span>Blocking state</span>
          <span className="font-semibold">{blockingState.isActive ? 'Active' : 'Inactive'} / {formatReason(blockingState.reason)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Storage</span>
          <span className={storageHealth.healthy ? 'font-semibold' : 'font-semibold text-red-500'}>
            {storageHealth.healthy ? 'OK' : 'Unavailable'}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <span>Permissions</span>
          <span className={permissionLabel === 'Healthy' ? 'font-semibold' : 'font-semibold text-yellow-500'}>
            {permissionLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Active rules</span>
          <span className="font-semibold">{blockingDiagnostics.activeRules}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Blocked (session)</span>
          <span className="font-semibold">{shortActivitySummary.blockedTotal}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Last decision</span>
          <span className="font-semibold capitalize">
            {blockingDiagnostics.lastDecision}{' '}
            <span className="text-gray-500 dark:text-gray-400">({blockingDiagnostics.lastReason})</span>
          </span>
        </div>
        {storageHealth.error ? <p className="text-[11px] text-red-500">{storageHealth.error}</p> : null}
        {permissionHealth.error ? <p className="text-[11px] text-yellow-500">{permissionHealth.error}</p> : null}
      </div>
    </section>
  );
};

function formatReason(reason: string): string {
  if (reason === 'outsideSchedule') {
    return 'Outside schedule';
  }
  return reason[0].toUpperCase() + reason.slice(1);
}

export default DiagnosticsCard;
