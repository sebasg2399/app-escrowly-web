import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
}

export default function Skeleton({ width = "w-full", height = "h-4", className }: SkeletonProps) {
  return (
    <div
      className={twMerge(clsx("animate-pulse rounded-lg bg-neutral-200", width, height, className))}
    />
  );
}
