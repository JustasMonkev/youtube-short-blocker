import React from 'react';
import { CustomSite, CustomSiteMode, SiteScope } from '../../../types';
import ToggleSwitch from '../ToggleSwitch';

interface CustomRuleItemProps {
  site: CustomSite;
  now: number;
  durationOptions: { label: string; value: number }[];
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
  onDurationChange: (minutes: number) => void;
  onModeChange: (mode: CustomSiteMode) => void;
  onScopeChange: (scope: SiteScope) => void;
}

const quickButtons = [15, 60, 240, 1440];

const CustomRuleItem: React.FC<CustomRuleItemProps> = ({
  site,
  now,
  durationOptions,
  onToggle,
  onRemove,
  onDurationChange,
  onModeChange,
  onScopeChange
}) => {
  const timeLeft = formatTimeLeft(site.expiresAt, now);
  const pathLabel = site.path ? `${site.host}${site.path}` : `${site.host} (all pages)`;

  const modeLabel = site.mode === 'block' ? 'Block' : site.mode === 'disable_js' ? 'Disable JS' : 'Smart whitelist';
  const scopeLabel = site.scope === 'watch' ? 'Watch' : site.scope === 'home' ? 'Home' : site.scope === 'search' ? 'Search' : 'All';

  const modeStyle =
    site.mode === 'block'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : site.mode === 'disable_js'
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';

  return (
    <li className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col gap-2 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-start gap-3">
        <ToggleSwitch checked={site.enabled} onChange={onToggle} small />
        <div className="flex flex-col flex-grow gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-gray-100" style={{ opacity: site.enabled ? 1 : 0.6 }}>
              {site.label || site.host}
            </span>
            <span
              className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full w-fit ${modeStyle}`}
            >
              {modeLabel}
            </span>
            <span className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {`Scope: ${scopeLabel}`}
            </span>
            {timeLeft && (
              <span className="text-[11px] bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded-full">
                {timeLeft}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{pathLabel}</p>
        </div>
        {!site.isProtected ? (
          <button
            onClick={onRemove}
            className="border-0 bg-transparent text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer text-base leading-none p-1"
            aria-label={`Remove ${site.label || site.host}`}
          >
            ✕
          </button>
        ) : (
          <span
            className="text-[11px] uppercase tracking-wide bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full"
            aria-label={`Protected ${site.label || site.host}`}
          >
            Protected
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-300">Mode</label>
          <select
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={site.mode}
            onChange={(event) => onModeChange(event.target.value as CustomSiteMode)}
          >
            <option value="block">Block</option>
            <option value="disable_js">Disable JS</option>
            <option value="whitelist">Smart whitelist</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-300">Scope</label>
          <select
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            value={site.scope || 'all'}
            onChange={(event) => onScopeChange(event.target.value as SiteScope)}
          >
            <option value="all">All</option>
            <option value="watch">Watch</option>
            <option value="home">Home</option>
            <option value="search">Search</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Pause timer:</span>
        {quickButtons.map((minutes) => (
          <button
            key={minutes}
            onClick={() => onDurationChange(minutes)}
            className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-700 dark:text-gray-300"
            type="button"
          >
            {formatMinutes(minutes)}
          </button>
        ))}
        <select
          className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
          className="ml-auto px-2 py-1 text-xs rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400"
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
