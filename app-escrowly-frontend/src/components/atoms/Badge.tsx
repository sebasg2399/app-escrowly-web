import { HTMLAttributes } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export type BadgeVariant = "info" | "success" | "warning" | "error" | "client" | "seller" | "admin";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  info: "bg-info/10 text-info-fg",
  success: "bg-success/10 text-success-fg",
  warning: "bg-warning/10 text-warning-fg",
  error: "bg-error/10 text-error-fg",
  client: "bg-primary/10 text-primary",
  seller: "bg-warning/10 text-warning-fg",
  admin: "bg-error/10 text-error-fg",
};

export default function Badge({ variant = "info", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
          variantClasses[variant],
          className,
        ),
      )}
      {...props}
    >
      {children}
    </span>
  );
}
