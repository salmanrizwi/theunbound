import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, helperText, error, children }) => {
  return (
    <div className="space-y-1">
      <label className="field-label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {helperText && <p className="helper-text">{helperText}</p>}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
};
