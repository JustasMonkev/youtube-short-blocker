import React from 'react';
import { CustomSite, CustomSiteMode, SiteScope } from '../../../types';
import CustomRuleForm from './CustomRuleForm';
import CustomRuleList from './CustomRuleList';

interface CustomRulesSectionProps {
  customUrl: string;
  durationMinutes: number;
  error: string;
  now: number;
  sites: CustomSite[];
  customMode: CustomSiteMode;
  customScope: SiteScope;
  onUrlChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onModeChange: (value: CustomSiteMode) => void;
  onScopeChange: (value: SiteScope) => void;
  onSubmit: () => void;
  onToggleSite: (id: string, checked: boolean) => void;
  onRemoveSite: (id: string) => void;
  onUpdateDuration: (id: string, minutes: number) => void;
  onUpdateMode: (id: string, mode: CustomSiteMode) => void;
  onUpdateScope: (id: string, scope: SiteScope) => void;
  onExportRules: () => void;
  onImportRules: (raw: string) => void;
}

const CustomRulesSection: React.FC<CustomRulesSectionProps> = ({
  customUrl,
  durationMinutes,
  error,
  now,
  sites,
  customMode,
  customScope,
  onUrlChange,
  onDurationChange,
  onModeChange,
  onScopeChange,
  onSubmit,
  onToggleSite,
  onRemoveSite,
  onUpdateDuration,
  onUpdateMode,
  onUpdateScope,
  onExportRules,
  onImportRules
}) => {
  const durationOptions = [
    { label: 'No timer', value: 0 },
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '4 hours', value: 240 },
    { label: '1 day', value: 1440 }
  ];

  return (
    <section className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
      <div className="mb-3">
        <h2 className="text-base font-semibold mb-1 dark:text-gray-100">Custom sites & timers</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Block entire sites like x.com or specific paths (e.g. youtube.com/shorts). Add an optional timer to auto-pause later.
        </p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onExportRules()}
          className="px-3 py-2 text-sm rounded-md bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.99] transition-all"
        >
          Export rules
        </button>
        <label className="inline-flex items-center justify-center px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
          Import rules
          <input
            type="file"
            accept=".json,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                onImportRules(String(reader.result || ''));
                event.target.value = '';
              };
              reader.readAsText(file);
            }}
          />
        </label>
      </div>

      <CustomRuleForm
        value={customUrl}
        error={error}
        durationMinutes={durationMinutes}
        durationOptions={durationOptions}
        mode={customMode}
        scope={customScope}
        onChange={onUrlChange}
        onDurationChange={onDurationChange}
        onModeChange={onModeChange}
        onScopeChange={onScopeChange}
        onSubmit={onSubmit}
      />
      <CustomRuleList
        sites={sites}
        now={now}
        durationOptions={durationOptions}
        onToggleSite={onToggleSite}
        onRemoveSite={onRemoveSite}
        onUpdateDuration={onUpdateDuration}
        onUpdateMode={onUpdateMode}
        onUpdateScope={onUpdateScope}
      />
    </section>
  );
};

export default CustomRulesSection;
