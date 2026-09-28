import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "destructive" | "success";
}

const TONES = {
  default: "bg-primary/10 text-primary",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  destructive: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
          <div className="mt-2 text-2xl font-semibold truncate">{value}</div>
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