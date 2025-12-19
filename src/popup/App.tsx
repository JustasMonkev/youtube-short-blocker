import React from 'react';
import Header from './components/Header';
import InfoCard from './components/InfoCard';
import ResetButton from './components/ResetButton';
import StatsCard from './components/StatsCard';
import StatusCard from './components/StatusCard';
import ToggleRow from './components/ToggleRow';
import CustomRulesSection from './components/CustomRules/CustomRulesSection';
import { useExtensionState } from './hooks/useExtensionState';
import { useCustomSites } from './hooks/useCustomSites';

const App: React.FC = () => {
  const { enabled, blockedCount, toggleEnabled, resetBlockedCount } = useExtensionState();
  const {
    customSites,
    customUrl,
    error,
    durationMinutes,
    now,
    updateCustomUrl,
    addSite,
    removeSite,
    toggleSite,
    setDurationMinutes,
    updateSiteDuration
  } = useCustomSites();

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-xl overflow-hidden min-h-[500px]">
      <Header />
      <div className="p-5 space-y-4">
        <StatusCard enabled={enabled} />
        <ToggleRow enabled={enabled} onToggle={toggleEnabled} />
        <StatsCard blockedCount={blockedCount} />
        <InfoCard />
        <CustomRulesSection
          customUrl={customUrl}
          durationMinutes={durationMinutes}
          error={error}
          now={now}
          sites={customSites}
          onUrlChange={updateCustomUrl}
          onDurationChange={setDurationMinutes}
          onSubmit={addSite}
          onToggleSite={toggleSite}
          onRemoveSite={removeSite}
          onUpdateDuration={updateSiteDuration}
        />
        <ResetButton onReset={resetBlockedCount} />
      </div>
    </div>
  );
};

export default App;
