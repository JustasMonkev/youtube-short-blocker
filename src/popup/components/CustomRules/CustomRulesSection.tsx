import React from 'react';
import { CustomSite } from '../../../types';
import CustomRuleForm from './CustomRuleForm';
import CustomRuleList from './CustomRuleList';

interface CustomRulesSectionProps {
  customUrl: string;
  durationMinutes: number;
  error: string;
  now: number;
  sites: CustomSite[];
  onUrlChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onSubmit: () => void;
  onToggleSite: (id: string, checked: boolean) => void;
  onRemoveSite: (id: string) => void;
  onUpdateDuration: (id: string, minutes: number) => void;
}

const CustomRulesSection: React.FC<CustomRulesSectionProps> = ({
  customUrl,
  durationMinutes,
  error,
  now,
  sites,
  onUrlChange,
  onDurationChange,
  onSubmit,
  onToggleSite,
  onRemoveSite,
  onUpdateDuration
}) => {
  const durationOptions = [
    { label: 'No timer', value: 0 },
    { label: '15 minutes', value: 15 },
    { label: '1 hour', value: 60 },
    { label: '4 hours', value: 240 },
    { label: '1 day', value: 1440 }
  ];

  return (
    <section className="mb-4 p-4 bg-gray-50 rounded-md border border-gray-100">
      <div className="mb-3">
        <h2 className="text-base font-semibold mb-1">Custom sites & timers</h2>
        <p className="text-sm text-gray-600">
          Block entire sites like x.com or specific paths (e.g. youtube.com/shorts). Add an optional timer to auto-pause later.
        </p>
      </div>

      <CustomRuleForm
        value={customUrl}
        error={error}
        durationMinutes={durationMinutes}
      durationOptions={durationOptions}
      onChange={onUrlChange}
      onDurationChange={onDurationChange}
      onSubmit={onSubmit}
    />
      <CustomRuleList
        sites={sites}
        now={now}
        durationOptions={durationOptions}
        onToggleSite={onToggleSite}
        onRemoveSite={onRemoveSite}
        onUpdateDuration={onUpdateDuration}
      />
    </section>
  );
};

export default CustomRulesSection;
