import React from 'react';
import { CustomSite } from '../../../types';
import CustomRuleItem from './CustomRuleItem';

interface CustomRuleListProps {
  sites: CustomSite[];
  now: number;
  durationOptions: { label: string; value: number }[];
  onToggleSite: (id: string, checked: boolean) => void;
  onRemoveSite: (id: string) => void;
  onUpdateDuration: (id: string, minutes: number) => void;
}

const CustomRuleList: React.FC<CustomRuleListProps> = ({
  sites,
  now,
  durationOptions,
  onToggleSite,
  onRemoveSite,
  onUpdateDuration
}) => (
  <ul className="flex flex-col gap-2">
    {sites.length === 0 ? (
      <li className="text-center text-gray-500 text-sm">No custom sites yet. Try x.com, tiktok.com, or reddit.com.</li>
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
        />
      ))
    )}
  </ul>
);

export default CustomRuleList;
