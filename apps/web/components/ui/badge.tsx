import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-slate-700 bg-slate-50",
      className
    )}
    {...props}
  />
);
