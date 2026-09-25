import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { HTMLAttributes } from "react";

export type BannerVariant = "info" | "success" | "error" | "warning";

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BannerVariant;
  title?: string;
}

const variantConfig: Record<BannerVariant, { bg: string; iconColor: string; icon: typeof Info }> = {
  info: { bg: "bg-info-bg border-info/20", iconColor: "text-info", icon: Info },
  success: { bg: "bg-success-bg border-success/20", iconColor: "text-success", icon: CheckCircle },
  error: { bg: "bg-error-bg border-error/20", iconColor: "text-error", icon: AlertCircle },
  warning: {
    bg: "bg-warning-bg border-warning/20",
    iconColor: "text-warning",
    icon: AlertTriangle,
  },
};

export default function Banner({
  variant = "info",
  title,
  className,
  children,
  ...props
}: BannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={twMerge(
        clsx("flex items-start gap-3 rounded-lg border px-4 py-3", config.bg, className),
      )}
      role="alert"
      {...props}
    >
      <Icon className={clsx("h-5 w-5 shrink-0 mt-0.5", config.iconColor)} />
      <div className="text-sm">
        {title && <p className="font-semibold text-foreground mb-0.5">{title}</p>}
        <div className="text-neutral-700">{children}</div>
      </div>
    </div>
  );
}
