import React from 'react';
import Icon from '../icons/Icon';

export const EmptyState: React.FC<{ icon?: React.ComponentProps<typeof Icon>['name']; title: string; message?: string; action?: React.ReactNode }> = ({
  icon = 'box', title, message, action,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
      <Icon name={icon} className="w-6 h-6" />
    </div>
    <p className="font-semibold text-text-main">{title}</p>
    {message && <p className="text-sm text-text-light mt-1 max-w-sm">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
