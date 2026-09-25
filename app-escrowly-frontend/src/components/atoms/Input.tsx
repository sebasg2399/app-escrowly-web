import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, leftIcon, rightIcon, disabled, ...props }, ref) => (
    <div className="relative w-full">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        className={twMerge(
          clsx(
            "w-full rounded-lg border bg-background px-4 py-2 text-sm text-foreground",
            "placeholder:text-neutral-400",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            hasError
              ? "border-error focus-visible:ring-error"
              : "border-neutral-200 focus-visible:border-primary",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            disabled && "bg-neutral-50 text-neutral-400 cursor-not-allowed",
            className,
          ),
        )}
        disabled={disabled}
        {...props}
      />
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
          {rightIcon}
        </div>
      )}
    </div>
  ),
);

Input.displayName = "Input";

export default Input;
