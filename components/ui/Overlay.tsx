import React, { useEffect } from 'react';
import Icon from '../icons/Icon';

/** Centered dialog for short forms and confirmations. */
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ isOpen, onClose, title, children, wide }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-center items-start sm:items-center p-4 overflow-y-auto animate-fade-in" onClick={onClose}>
      <div
        className={`bg-card rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} my-8 animate-scale-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-main">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

/** Right-hand slide-over used for record detail views (asset detail, document detail). */
export const Drawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ isOpen, onClose, title, subtitle, children, actions }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 animate-fade-in" onClick={onClose} />
      <div className="relative bg-background w-full max-w-3xl h-full shadow-2xl flex flex-col animate-fade-in-up overflow-hidden">
        <div className="flex justify-between items-start px-6 py-5 border-b border-border bg-card">
          <div>
            <h2 className="text-xl font-bold text-text-main">{title}</h2>
            {subtitle && <p className="text-sm text-text-light mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1" aria-label="Close">
            <Icon name="close" className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">{children}</div>
        {actions && <div className="border-t border-border bg-card px-6 py-4 flex justify-end gap-3">{actions}</div>}
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'primary' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-text-main">{title}</h3>
          <p className="mt-2 text-sm text-text-light">{message}</p>
        </div>
        <div className="flex justify-end items-center px-6 py-4 bg-slate-50 rounded-b-xl gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-border rounded-md shadow-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
