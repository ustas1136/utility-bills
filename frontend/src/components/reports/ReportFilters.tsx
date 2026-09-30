import type { ReportMode } from "@/api/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

interface Props {
  from: string;
  to: string;
  preset: PeriodPreset;
  mode: ReportMode;
  /** Отчёт по потреблению не зависит от режима — прячем переключатель. */
  showMode?: boolean;
  onRangeChange: (from: string, to: string) => void;
  onModeChange: (mode: ReportMode) => void;
}

const MODES: { value: ReportMode; label: string }[] = [
  { value: "paid", label: "Оплачено" },
  { value: "accrued", label: "Начислено" },
];

export function ReportFilters({
  from,
  to,
  preset,
  mode,
  showMode = true,
  onRangeChange,
  onModeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Период
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map((p) => (
            <Button
              key={p.value}
              variant={preset === p.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => {
                const range = presetRange(p.value);
                onRangeChange(range.from, range.to);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Даты
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            max={to}
            aria-label="Начало периода"
            onChange={(e) => {
              if (e.target.value) onRangeChange(e.target.value, to);
            }}
            className="w-[9.5rem]"
          />
          <span className="text-sm text-muted-foreground">—</span>
          <Input
            type="date"
            value={to}
            min={from}
            aria-label="Конец периода"
            onChange={(e) => {
              if (e.target.value) onRangeChange(from, e.target.value);
            }}
            className="w-[9.5rem]"
          />
        </div>
      </div>

      {showMode && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Считать
          </div>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                variant={mode === m.value ? "default" : "outline"}
                size="sm"
                className={cn("rounded-full")}
                onClick={() => onModeChange(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
