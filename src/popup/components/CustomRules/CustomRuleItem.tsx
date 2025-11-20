import React from 'react';
import { CustomSite } from '../../../types';
import ToggleSwitch from '../ToggleSwitch';

interface CustomRuleItemProps {
  site: CustomSite;
  now: number;
  durationOptions: { label: string; value: number }[];
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
  onDurationChange: (minutes: number) => void;
}

const quickButtons = [15, 60, 240, 1440];

const CustomRuleItem: React.FC<CustomRuleItemProps> = ({
  site,
  now,
  durationOptions,
  onToggle,
  onRemove,
  onDurationChange
}) => {
  const timeLeft = formatTimeLeft(site.expiresAt, now);
  const pathLabel = site.path ? `${site.host}${site.path}` : `${site.host} (all pages)`;

  return (
    <li className="p-3 border border-gray-200 rounded-lg flex flex-col gap-2 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        <ToggleSwitch checked={site.enabled} onChange={onToggle} small />
        <div className="flex flex-col flex-grow gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900" style={{ opacity: site.enabled ? 1 : 0.6 }}>
              {site.label || site.host}
            </span>
            <span
              className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full w-fit ${
                site.mode === 'block' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {site.mode === 'block' ? 'Blocked' : 'JS disabled'}
            </span>
            {timeLeft && (
              <span className="text-[11px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                {timeLeft}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600">{pathLabel}</p>
        </div>
        <button
          onClick={onRemove}
          className="border-0 bg-transparent text-gray-500 hover:text-red-500 cursor-pointer text-base leading-none p-1"
          aria-label={`Remove ${site.label || site.host}`}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] uppercase tracking-wide text-gray-500 mr-1">Timer:</span>
        {quickButtons.map((minutes) => (
          <button
            key={minutes}
            onClick={() => onDurationChange(minutes)}
            className="px-2 py-1 text-xs rounded-full bg-gray-100 hover:bg-primary-100 text-gray-700"
            type="button"
          >
            {formatMinutes(minutes)}
          </button>
        ))}
        <select
          className="px-2 py-1 text-xs border border-gray-200 rounded-full bg-white"
          defaultValue=""
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isNaN(value)) {
              onDurationChange(value);
            }
            event.currentTarget.value = '';
          }}
        >
          <option value="" disabled>
            More...
          </option>
          {durationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDurationChange(0)}
          className="ml-auto px-2 py-1 text-xs rounded-full bg-white border border-gray-200 hover:border-red-200 hover:text-red-500"
          type="button"
        >
          Clear timer
        </button>
      </div>
    </li>
  );
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  if (minutes % 1440 === 0) {
    return `${minutes / 1440}d`;
  }
  return `${minutes / 60}h`;
}

function formatTimeLeft(expiresAt: number | null | undefined, now: number): string | null {
  if (!expiresAt) {
    return null;
  }

  const diff = expiresAt - now;
  if (diff <= 0) {
    return 'Timer ended';
  }

  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) {
    return `${minutes}m left`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes ? `${hours}h ${remainingMinutes}m left` : `${hours}h left`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h left` : `${days}d left`;
}

export default CustomRuleItem;
