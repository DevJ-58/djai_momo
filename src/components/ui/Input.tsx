import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, icon, id, className = '', ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <div className={`input-wrap ${error ? 'input-wrap-error' : ''}`}>
        {icon && <span className="input-icon" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`input ${icon ? 'input-with-icon' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      </div>
      {error && <p className="field-error" id={`${inputId}-error`}>{error}</p>}
    </div>
  );
});
