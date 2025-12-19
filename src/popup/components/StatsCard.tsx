import React from 'react';

interface StatsCardProps {
  blockedCount: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ blockedCount }) => (
  <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex items-center justify-between">
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">Redirects prevented</span>
      <span className="text-3xl font-bold text-primary-500 dark:text-primary-400 leading-tight">{blockedCount}</span>
    </div>
    <div className="text-xs text-gray-600 dark:text-gray-400 max-w-[140px]">
      Includes YouTube Shorts plus any custom sites you block.
    </div>
  </div>
);

export default StatsCard;
