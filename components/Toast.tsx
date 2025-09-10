import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto-close after 3 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-secondary' : 'bg-red-500';

  return (
    <div className={`fixed bottom-5 right-5 ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg flex items-center animate-fade-in-up z-50`}>
      <p className="font-medium">{message}</p>
      <button onClick={onClose} className="ml-4 font-semibold opacity-80 hover:opacity-100">&times;</button>
    </div>
  );
};

export default Toast;
