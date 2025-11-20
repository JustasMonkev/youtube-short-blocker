import React from 'react';

interface ResetButtonProps {
  onReset: () => void;
}

const ResetButton: React.FC<ResetButtonProps> = ({ onReset }) => (
  <button
    onClick={onReset}
    className="w-full px-3 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 active:scale-[0.98] transition-all shadow-sm"
  >
    Reset Counter
  </button>
);

export default ResetButton;
