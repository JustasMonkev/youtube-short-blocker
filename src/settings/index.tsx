import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsApp from '../popup/components/SettingsApp';
import { useCustomSites } from '../popup/hooks/useCustomSites';
import { useExtensionState } from '../popup/hooks/useExtensionState';
import './styles.css';

const App = () => {
  const extensionState = useExtensionState();
  const customSitesState = useCustomSites();

  return <SettingsApp extensionState={extensionState} customSitesState={customSitesState} />;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
