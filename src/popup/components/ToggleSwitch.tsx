import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  small?: boolean;
  inverted?: boolean; // For use on dark backgrounds
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  small = false,
  inverted = false,
  disabled = false
}) => (
  <label className={`relative inline-block flex-shrink-0 ${small ? 'w-9 h-5' : 'w-12 h-6'}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => {
        if (disabled) {
          return;
        }
        onChange(event.target.checked);
      }}
      disabled={disabled}
      className="opacity-0 w-0 h-0 cursor-pointer peer"
    />
    <span
      className={`absolute ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} top-0 left-0 right-0 bottom-0 transition-all rounded-full ${
        inverted 
          ? (checked ? 'bg-white/30' : 'bg-white/20')
          : (checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600')
      } before:absolute before:content-[''] before:transition-all before:rounded-full ${
        inverted 
          ? 'before:bg-white'
          : 'before:bg-white dark:before:bg-gray-100'
      } ${
        small
          ? 'before:h-3.5 before:w-3.5 before:left-0.5 before:bottom-0.5'
          : 'before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px]'
      } ${checked ? (small ? 'before:translate-x-4' : 'before:translate-x-6') : ''}`}
    />
  </label>
);

export default ToggleSwitch;
