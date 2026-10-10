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
  pending: "bg-[var(--muted)] text-[var(--muted-foreground)] border-transparent",
  partial: "bg-[var(--warning-bg)] text-[var(--warning)] border-transparent",
  paid: "bg-[var(--success-bg)] text-[var(--success)] border-transparent",
  overdue: "bg-[var(--critical-bg)] text-[var(--critical)] border-transparent",
  cancelled:
    "bg-[var(--muted)] text-[var(--muted-foreground)] line-through border-transparent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        // §5: статус — 6px, не пилюля. cn() = twMerge, поэтому это
        // перекрывает rounded-full из базовых классов Badge.
        "rounded-[var(--radius-option)] font-normal",
        TONES[status],
      )}
    >
      {LABELS[status] ?? status}
    </Badge>
  );
}