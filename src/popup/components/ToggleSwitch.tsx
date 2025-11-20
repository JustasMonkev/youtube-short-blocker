import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  small?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, small = false }) => (
  <label className={`relative inline-block flex-shrink-0 ${small ? 'w-9 h-5' : 'w-12 h-6'}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="opacity-0 w-0 h-0"
    />
    <span
      className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 transition-all rounded-full ${
        checked ? 'bg-primary-500' : 'bg-gray-300'
      } before:absolute before:content-[''] before:bg-white before:transition-all before:rounded-full ${
        small
          ? 'before:h-3.5 before:w-3.5 before:left-0.5 before:bottom-0.5'
          : 'before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px]'
      } ${checked ? (small ? 'before:translate-x-4' : 'before:translate-x-6') : ''}`}
    />
  </label>
);

export default ToggleSwitch;
