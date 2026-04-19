import React from 'react';
import { useExtensionState } from './hooks/useExtensionState';
import PopupApp from './components/PopupApp';
import { openOrFocusSettingsTab } from './utils/openSettingsTab';

const App: React.FC = () => {
  const { blockedCount, blockingState } = useExtensionState();

  return (
    <PopupApp
      blockedCount={blockedCount}
      blockingState={blockingState}
      onOpenSettings={openOrFocusSettingsTab}
    />
  );
};

export default App;
