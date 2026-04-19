import React from 'react';
import { summarizeBlockedByDay } from '../utils/popupStateHelpers';

interface DailySummaryCardProps {
  blockedCountByDay?: Record<string, number> | null;
}

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ blockedCountByDay }) => {
  const rows = summarizeBlockedByDay(blockedCountByDay || {}, { maxDays: 14 });

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="p-4 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Daily redirect summary</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Blocked redirects aggregated per day (if reported).</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No daily data available yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows
            .slice()
            .reverse()
            .map((row) => (
              <li key={row.date} className="flex items-center justify-between">
                <span>{row.label}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          <li className="pt-2 mt-1 border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-between">
            <span>Total (14 days)</span>
            <span className="font-semibold">{total}</span>
          </li>
        </ul>
      )}
    </section>
  );
};

export default DailySummaryCard;
