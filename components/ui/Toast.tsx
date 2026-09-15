import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon } from '../icons/Icon';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastContext = createContext<(message: string, type?: ToastItem['type']) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const TONE: Record<ToastItem['type'], string> = {
  success: 'bg-secondary',
  error: 'bg-red-600',
  info: 'bg-slate-800',
};

const ToastItemView: React.FC<{ item: ToastItem; onClose: () => void }> = ({ item, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`${TONE[item.type]} text-white py-3 px-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up min-w-[260px]`}>
      <Icon name={item.type === 'success' ? 'check' : item.type === 'error' ? 'alert' : 'bell'} className="w-5 h-5 shrink-0" />
      <p className="text-sm font-medium flex-1">{item.message}</p>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    setItems(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
  }, []);

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
        {items.map(item => (
          <ToastItemView key={item.id} item={item} onClose={() => remove(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
