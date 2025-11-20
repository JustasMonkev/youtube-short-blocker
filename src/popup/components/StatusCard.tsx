import React from 'react';

interface StatusCardProps {
  enabled: boolean;
}

const StatusCard: React.FC<StatusCardProps> = ({ enabled }) => (
  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg border border-primary-100">
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-gray-600">Global status</span>
      <span className="text-sm text-gray-700">
        {enabled ? 'Redirects and timers are active.' : 'Blocking is paused.'}
      </span>
    </div>
    <span
      className={`font-semibold px-3 py-1 rounded-full text-sm ${
        enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {enabled ? 'Active' : 'Paused'}
    </span>
  </div>
);

export default StatusCard;
