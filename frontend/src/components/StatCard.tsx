import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "destructive" | "success";
}

// §2: карточка нейтральная, цвет — только у иконки и только по смыслу.
// Значения — на токенах, поэтому иконки следуют теме (включая comfort).
const TONES = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  destructive: "bg-[var(--critical-bg)] text-[var(--critical)]",
  success: "bg-[var(--success-bg)] text-[var(--success)]",
};

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-[1.75rem] leading-9 sm:text-[2rem] sm:leading-10 font-semibold tabular-nums truncate">{value}</div>
          {sublabel && (
            <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
          )}
        </div>
        <div className={cn("shrink-0 rounded-lg p-2.5", TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}