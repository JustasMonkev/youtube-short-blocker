import React from 'react';
import { CustomSiteMode, SiteScope } from '../../../types';

interface CustomRuleFormProps {
  value: string;
  error: string;
  durationMinutes: number;
  durationOptions: { label: string; value: number }[];
  mode: CustomSiteMode;
  scope: SiteScope;
  onChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onModeChange: (value: CustomSiteMode) => void;
  onScopeChange: (value: SiteScope) => void;
  onSubmit: () => void;
}

const CustomRuleForm: React.FC<CustomRuleFormProps> = ({
  value,
  error,
  durationMinutes,
  mode,
  scope,
  durationOptions,
  onChange,
  onDurationChange,
  onModeChange,
  onScopeChange,
  onSubmit
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const modeOptions: { value: CustomSiteMode; label: string }[] = [
    { value: 'block', label: 'Block' },
    { value: 'disable_js', label: 'Disable JavaScript' },
    { value: 'whitelist', label: 'Smart whitelist' }
  ];

  const scopeOptions: { value: SiteScope; label: string }[] = [
    { value: 'all', label: 'All pages' },
    { value: 'watch', label: 'Watch pages' },
    { value: 'home', label: 'Home / feed' },
    { value: 'search', label: 'Search pages' }
  ];

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="custom-site">
            Website to block
          </label>
          <input
            id="custom-site"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="e.g. x.com or youtube.com/shorts"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="rule-mode">
            Rule mode
          </label>
          <select
            id="rule-mode"
            value={mode}
            onChange={(event) => onModeChange(event.target.value as CustomSiteMode)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="rule-scope">
            Apply to scope
          </label>
          <select
            id="rule-scope"
            value={scope}
            onChange={(event) => onScopeChange(event.target.value as SiteScope)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="block-duration">
            Block duration
          </label>
          <select
            id="block-duration"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {durationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="w-full px-3 py-2 bg-primary-500 text-white rounded-md text-sm font-semibold hover:bg-primary-600 active:scale-[0.98] transition-all"
        >
          Add to blocklist
        </button>
      </form>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
    </>
  );
};

export default CustomRuleForm;
