import React from 'react';
import ToggleSwitch from './ToggleSwitch';

interface ToggleRowProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ enabled, onToggle }) => (
  <div className="flex items-start gap-3 p-3 bg-white rounded-md border border-gray-200 shadow-sm">
    <ToggleSwitch checked={enabled} onChange={onToggle} />
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-gray-900">Master switch</span>
      <span className="text-sm text-gray-600">
        Applies to Shorts redirects and every custom site/timer you add.
      </span>
    </div>
  </div>
);

export default ToggleRow;
