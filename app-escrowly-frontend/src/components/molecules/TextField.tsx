import { useId } from "react";
import Input from "../atoms/Input";
import clsx from "clsx";

export interface TextFieldProps {
  id?: string;
  label: string;
  value?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export default function TextField({
  id: providedId,
  label,
  error,
  helper,
  icon,
  disabled,
  required,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const describedBy =
    [error ? errorId : null, !error && helper ? helperId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className={clsx(
          "block text-sm font-medium text-foreground mb-1.5",
          disabled && "text-neutral-400",
        )}
      >
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      <Input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        hasError={!!error}
        leftIcon={icon}
        disabled={disabled}
        required={required}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helper && (
        <p id={helperId} className="mt-1 text-xs text-neutral-500">
          {helper}
        </p>
      )}
    </div>
  );
}
