import React from 'react';
import { CustomSite, CustomSiteMode, ScheduleWindow, SiteScope } from '../../types';
import {
  BlockingDiagnostics,
  ShortActivitySummary
} from '../../types';
import { PopupBlockingState } from '../utils/popupStateHelpers';
import StatusCard from './StatusCard';
import StatsCard from './StatsCard';
import GlobalControlsCard from './GlobalControlsCard';
import DailySummaryCard from './DailySummaryCard';
import DiagnosticsCard from './DiagnosticsCard';
import CustomRulesSection from './CustomRules/CustomRulesSection';
import Header from './Header';
import InfoCard from './InfoCard';

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

interface ExtensionStateForSettings {
  blockedCount: number;
  blockedCountByDay: Record<string, number>;
  blockingState: PopupBlockingState;
  globalCooldownUntil: number | null;
  emergencyMode: boolean;
  scheduleWindow: ScheduleWindow | null;
  shortActivitySummary: ShortActivitySummary;
  blockingDiagnostics: BlockingDiagnostics;
  permissionHealth: PermissionHealth;
  storageHealth: StorageHealth;
  isInCooldown: boolean;
  setCooldown: (minutes: number) => void;
  toggleEmergencyMode: (enabled: boolean) => void;
  updateScheduleWindow: (window: ScheduleWindow | null) => void;
  refreshHealth: () => void;
}

interface CustomSitesStateForSettings {
  customSites: CustomSite[];
  customUrl: string;
  error: string;
  durationMinutes: number;
  customMode: CustomSiteMode;
  customScope: SiteScope;
  now: number;
  updateCustomUrl: (value: string) => void;
  addSite: () => void;
  removeSite: (id: string) => void;
  toggleSite: (id: string, checked: boolean) => void;
  setDurationMinutes: (value: number) => void;
  setCustomMode: (value: CustomSiteMode) => void;
  setCustomScope: (value: SiteScope) => void;
  updateSiteDuration: (id: string, minutes: number) => void;
  updateSiteMode: (id: string, mode: CustomSiteMode) => void;
  updateSiteScope: (id: string, scope: SiteScope) => void;
  exportSites: () => string;
  importSites: (raw: string) => boolean;
}

interface SettingsAppProps {
  extensionState: ExtensionStateForSettings;
  customSitesState: CustomSitesStateForSettings;
}

const SettingsApp: React.FC<SettingsAppProps> = ({ extensionState, customSitesState }) => {
  const {
    blockedCount,
    blockedCountByDay,
    blockingState,
    globalCooldownUntil,
    emergencyMode,
    scheduleWindow,
    shortActivitySummary,
    blockingDiagnostics,
    permissionHealth,
    storageHealth,
    isInCooldown,
    setCooldown,
    toggleEmergencyMode,
    updateScheduleWindow
  } = extensionState;

  const {
    customSites,
    customUrl,
    error,
    durationMinutes,
    now,
    customMode,
    customScope,
    updateCustomUrl,
    addSite,
    removeSite,
    toggleSite,
    setDurationMinutes,
    setCustomMode,
    setCustomScope,
    updateSiteDuration,
    updateSiteMode,
    updateSiteScope,
    exportSites,
    importSites
  } = customSitesState;

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-primary-50 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 md:py-6 space-y-4">
        <Header />

        <section className="grid gap-4 md:grid-cols-2">
          <StatusCard
            enabled={blockingState.isActive}
            reason={formatBlockingReason(blockingState.reason)}
            reasonCode={blockingState.reason}
            cooldownMinutesLeft={blockingState.cooldownMinutesLeft}
          />
          <div className="grid gap-4">
            <StatsCard blockedCount={blockedCount} />
            <InfoCard />
          </div>
        </section>

        <GlobalControlsCard
          globalCooldownUntil={globalCooldownUntil}
          isInCooldown={isInCooldown}
          onSetCooldown={setCooldown}
          scheduleWindow={scheduleWindow}
          onUpdateScheduleWindow={updateScheduleWindow}
          emergencyMode={emergencyMode}
          onToggleEmergencyMode={toggleEmergencyMode}
        />

        <CustomRulesSection
          customUrl={customUrl}
          durationMinutes={durationMinutes}
          error={error}
          now={now}
          sites={customSites}
          customMode={customMode}
          customScope={customScope}
          onUrlChange={updateCustomUrl}
          onDurationChange={setDurationMinutes}
          onModeChange={setCustomMode}
          onScopeChange={setCustomScope}
          onSubmit={addSite}
          onToggleSite={toggleSite}
          onRemoveSite={removeSite}
          onUpdateDuration={updateSiteDuration}
          onUpdateMode={updateSiteMode}
          onUpdateScope={updateSiteScope}
          onExportRules={exportSites}
          onImportRules={importSites}
        />

        <DailySummaryCard blockedCountByDay={blockedCountByDay} />
        <DiagnosticsCard
          blockingState={blockingState}
          shortActivitySummary={shortActivitySummary}
          blockingDiagnostics={blockingDiagnostics}
          permissionHealth={permissionHealth}
          storageHealth={storageHealth}
        />

      </div>
    </main>
  );
};

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

export default SettingsApp;
