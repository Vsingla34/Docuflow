
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-card p-6 rounded-xl shadow-sm flex items-center justify-between transition-transform duration-300 hover:-translate-y-1">
      <div>
        <p className="text-sm font-medium text-text-light">{title}</p>
        <p className="text-3xl font-bold text-text-main">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
  );
};

export default DashboardCard;
