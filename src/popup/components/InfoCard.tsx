import React from 'react';

const InfoCard: React.FC = () => (
  <div className="p-4 bg-white rounded-md border border-gray-200 text-sm text-gray-700 leading-relaxed shadow-sm">
    <p className="mb-2">
      This extension redirects YouTube Shorts URLs back to the YouTube homepage and blocks any sites you add below.
    </p>
    <p className="mb-0">
      Set a timer to auto-disable a site later, or leave it off to block indefinitely.
    </p>
  </div>
);

export default InfoCard;
