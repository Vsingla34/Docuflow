import React from 'react';

const GoogleDriveIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7.71 5L12 12l4.29-7H7.71zM16.29 19L12 12l-4.29 7h8.58zM5 13.5L12 1l7 12.5-3.5 6H8.5L5 13.5z"/>
  </svg>
);

export default GoogleDriveIcon;
