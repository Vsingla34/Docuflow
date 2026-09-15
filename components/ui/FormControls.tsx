import React from 'react';

export const Field: React.FC<{ label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }> = ({
  label, hint, required, className = '', children,
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-text-main mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="mt-1 text-xs text-text-light">{hint}</p>}
  </div>
);

const baseInput = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-white disabled:bg-slate-50 disabled:text-slate-400';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input className={`${baseInput} ${className}`} {...props} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea className={`${baseInput} ${className}`} {...props} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }> = ({ className = '', children, ...props }) => (
  <select className={`${baseInput} ${className}`} {...props}>
    {children}
  </select>
);

export const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }> = ({ label, checked, onChange, className = '' }) => (
  <label className={`flex items-center gap-2 text-sm text-text-main cursor-pointer ${className}`}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
    {label}
  </label>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ className = '', icon, children, ...props }) => (
  <button
    className={`inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ className = '', icon, children, ...props }) => (
  <button
    className={`inline-flex items-center gap-2 bg-white text-text-main border border-border px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

export const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ className = '', icon, children, ...props }) => (
  <button
    className={`inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

export const LinkButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...props }) => (
  <button className={`text-primary hover:underline text-sm font-semibold disabled:opacity-40 disabled:no-underline ${className}`} {...props}>
    {children}
  </button>
);
