import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastVariant = "info" | "success" | "error" | "warning";

export interface ToastProps {
  variant?: ToastVariant;
  message: string;
  onClose?: () => void;
  className?: string;
}

const variantConfig: Record<ToastVariant, { bg: string; iconColor: string; icon: typeof Info }> = {
  info: { bg: "bg-info text-white", iconColor: "text-white/80", icon: Info },
  success: { bg: "bg-success text-white", iconColor: "text-white/80", icon: CheckCircle },
  error: { bg: "bg-error text-white", iconColor: "text-white/80", icon: AlertCircle },
  warning: { bg: "bg-warning text-white", iconColor: "text-white/80", icon: AlertTriangle },
};

export default function Toast({ variant = "info", message, onClose, className }: ToastProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={twMerge(
        clsx("flex items-center gap-3 rounded-lg px-4 py-3 shadow-card", config.bg, className),
      )}
      role="status"
    >
      <Icon className={clsx("h-5 w-5 shrink-0", config.iconColor)} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
