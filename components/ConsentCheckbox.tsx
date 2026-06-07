import React from 'react';
import { Link } from 'react-router-dom';

interface ConsentCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
  disabled?: boolean;
}

const ConsentCheckbox: React.FC<ConsentCheckboxProps> = ({
  id,
  checked,
  onChange,
  required = false,
  children,
  linkHref,
  linkLabel,
  disabled = false,
}) => {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
        checked
          ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/30'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/30 shrink-0"
        required={required}
      />
      <span className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {children}
        {linkHref && linkLabel && (
          <>
            {' '}
            <Link
              to={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-bold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {linkLabel}
            </Link>
          </>
        )}
      </span>
    </label>
  );
};

export default ConsentCheckbox;
