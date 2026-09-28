import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  pending: "Ожидает",
  partial: "Частично",
  paid: "Оплачено",
  overdue: "Просрочен",
  cancelled: "Отменён",
};

const TONES: Record<string, string> = {
  pending:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent",
  partial:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-transparent",
  overdue:
    "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-transparent",
  cancelled: "bg-muted text-muted-foreground line-through border-transparent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", TONES[status])}>
      {LABELS[status] ?? status}
    </Badge>
  );
}