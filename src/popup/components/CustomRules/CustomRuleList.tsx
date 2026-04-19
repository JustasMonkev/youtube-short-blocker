import React from 'react';
import { CustomSite, CustomSiteMode, SiteScope } from '../../../types';
import CustomRuleItem from './CustomRuleItem';

interface CustomRuleListProps {
  sites: CustomSite[];
  now: number;
  durationOptions: { label: string; value: number }[];
  onToggleSite: (id: string, checked: boolean) => void;
  onRemoveSite: (id: string) => void;
  onUpdateDuration: (id: string, minutes: number) => void;
  onUpdateMode: (id: string, mode: CustomSiteMode) => void;
  onUpdateScope: (id: string, scope: SiteScope) => void;
}

const CustomRuleList: React.FC<CustomRuleListProps> = ({
  sites,
  now,
  durationOptions,
  onToggleSite,
  onRemoveSite,
  onUpdateDuration,
  onUpdateMode,
  onUpdateScope
}) => (
  <ul className="flex flex-col gap-2">
    {sites.length === 0 ? (
      <li className="text-center text-gray-500 dark:text-gray-400 text-sm">No custom sites yet. Try x.com, tiktok.com, or reddit.com.</li>
    ) : (
      sites.map((site) => (
        <CustomRuleItem
          key={site.id}
          site={site}
          now={now}
          durationOptions={durationOptions}
          onToggle={(checked) => onToggleSite(site.id, checked)}
          onRemove={() => onRemoveSite(site.id)}
          onDurationChange={(minutes) => onUpdateDuration(site.id, minutes)}
          onModeChange={(mode) => onUpdateMode(site.id, mode)}
          onScopeChange={(scope) => onUpdateScope(site.id, scope)}
        />
      ))
    )}
  </ul>
);

export default CustomRuleList;
