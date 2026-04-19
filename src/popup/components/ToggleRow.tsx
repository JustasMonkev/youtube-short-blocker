import React from 'react';
import ToggleSwitch from './ToggleSwitch';

interface ToggleRowProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ enabled, onToggle, disabled = false }) => (
  <div className={`flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm ${disabled ? 'opacity-75' : ''}`}>
    <ToggleSwitch checked={enabled} onChange={onToggle} disabled={disabled} />
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-gray-900 dark:text-gray-100">Master switch</span>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Applies to Shorts redirects and every custom site/timer you add.
      </span>
    </div>
  </div>
);

export default ToggleRow;
