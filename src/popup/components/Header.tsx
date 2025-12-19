import React from 'react';
import { useExtensionState } from '../hooks/useExtensionState';
import ToggleSwitch from './ToggleSwitch';

const Header: React.FC = () => {
  const { darkMode, toggleDarkMode } = useExtensionState();

  return (
    <div className="bg-gradient-to-br from-primary-500 to-secondary-500 dark:from-primary-900 dark:to-secondary-900 text-white py-5 px-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-left">
          <h1 className="text-lg font-semibold">YouTube Shorts Blocker</h1>
          <p className="text-sm text-white/80">Stay focused and set timebound website blocks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs">🌙</span>
            <ToggleSwitch checked={darkMode} onChange={toggleDarkMode} small={true} inverted={true} />
          </div>
          <div className="h-10 w-10 rounded-lg border border-white/30 bg-white/10 flex items-center justify-center text-xl">
            ⏳
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
