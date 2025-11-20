import React from 'react';

interface StatsCardProps {
  blockedCount: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ blockedCount }) => (
  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-between">
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-gray-600">Redirects prevented</span>
      <span className="text-3xl font-bold text-primary-500 leading-tight">{blockedCount}</span>
    </div>
    <div className="text-xs text-gray-600 max-w-[140px]">
      Includes YouTube Shorts plus any custom sites you block.
    </div>
  </div>
);

export default StatsCard;
