import React, { useEffect, useState } from 'react';
import { ScheduleWindow } from '../../types';
import { minuteToTimeString, timeStringToMinute } from '../utils/popupStateHelpers';

interface GlobalControlsCardProps {
  globalCooldownUntil: number | null;
  isInCooldown: boolean;
  onSetCooldown: (minutes: number) => void;
  scheduleWindow: ScheduleWindow | null;
  onUpdateScheduleWindow: (window: ScheduleWindow | null) => void;
  emergencyMode: boolean;
  onToggleEmergencyMode: (enabled: boolean) => void;
}

const cooldownMinutes = [5, 15, 30, 60];

const GlobalControlsCard: React.FC<GlobalControlsCardProps> = ({
  globalCooldownUntil,
  isInCooldown,
  onSetCooldown,
  scheduleWindow,
  onUpdateScheduleWindow,
  emergencyMode,
  onToggleEmergencyMode
}) => {
  const [startValue, setStartValue] = useState(minuteToTimeString(scheduleWindow?.startMinute || 0));
  const [endValue, setEndValue] = useState(minuteToTimeString(scheduleWindow?.endMinute || 0));

  useEffect(() => {
    setStartValue(scheduleWindow ? minuteToTimeString(scheduleWindow.startMinute) : '00:00');
    setEndValue(scheduleWindow ? minuteToTimeString(scheduleWindow.endMinute) : '00:00');
  }, [scheduleWindow]);

  const applySchedule = (startRaw: string, endRaw: string) => {
    const start = timeStringToMinute(startRaw);
    const end = timeStringToMinute(endRaw);
    if (start === null || end === null) {
      return;
    }

    onUpdateScheduleWindow({ startMinute: start, endMinute: end });
  };

  return (
    <section className="grid gap-3 p-4 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Global controls</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Pause blocking globally, set active window, or enable emergency mode.</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">Temporary global pause</span>
        <div className="flex flex-wrap items-center gap-2">
          {cooldownMinutes.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onSetCooldown(minutes)}
              className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/30"
            >
              {minutes}m
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSetCooldown(0)}
            className="px-3 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-700"
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {isInCooldown
            ? `Global pause active until ${new Date(globalCooldownUntil || 0).toLocaleTimeString()}`
            : 'No global pause'}
        </p>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <span className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">Schedule window</span>
        <div className="grid gap-2 sm:grid-cols-2 mt-1">
          <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
            Start
            <input
              type="time"
              value={startValue}
              onChange={(event) => {
                const next = event.target.value;
                setStartValue(next);
                applySchedule(next, endValue);
              }}
              className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
            End
            <input
              type="time"
              value={endValue}
              onChange={(event) => {
                const next = event.target.value;
                setEndValue(next);
                applySchedule(startValue, next);
              }}
              className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </label>
        </div>
        <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
          Current: {scheduleWindow ? `${minuteToTimeString(scheduleWindow.startMinute)}–${minuteToTimeString(scheduleWindow.endMinute)}` : 'All day'}
        </p>
        <button
          type="button"
          onClick={() => onUpdateScheduleWindow(null)}
          className="mt-2 px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700"
        >
          Clear schedule (all day)
        </button>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <span className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">Emergency mode</span>
        <button
          type="button"
          onClick={() => onToggleEmergencyMode(!emergencyMode)}
          className={`mt-2 px-3 py-2 rounded-md text-sm font-medium ${
            emergencyMode
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-900 dark:bg-gray-700 text-white'
          }`}
        >
          {emergencyMode ? 'Disable emergency mode' : 'Enable emergency mode'}
        </button>
      </div>
    </section>
  );
};

export default GlobalControlsCard;
