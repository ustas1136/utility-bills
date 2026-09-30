import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  Download,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { reportsApi, type ReportMode } from "@/api/reports";
import { ByPropertyExpensesReport } from "@/components/reports/ByPropertyExpensesReport";
import { ConsumptionReport } from "@/components/reports/ConsumptionReport";
import { MonthlyExpensesReport } from "@/components/reports/MonthlyExpensesReport";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PRESET, matchPreset, presetRange } from "@/lib/date-range";
import { csvFilename, totalsByCurrency } from "@/lib/report-data";

type ReportTab = "monthly" | "properties" | "consumption";

const TABS: { value: ReportTab; label: string; icon: LucideIcon }[] = [
  { value: "monthly", label: "По месяцам", icon: BarChart3 },
  { value: "properties", label: "По объектам", icon: Building2 },
  { value: "consumption", label: "Потребление", icon: Gauge },
];

const FALLBACK_CURRENCY = "RUB";

export function ReportsPage() {
  const [range, setRange] = useState(() => presetRange(DEFAULT_PRESET));
  const [mode, setMode] = useState<ReportMode>("paid");
  const [tab, setTab] = useState<ReportTab>("monthly");
  const [exporting, setExporting] = useState(false);

  const { from, to } = range;
  // ISO-даты сравниваются лексикографически — этого достаточно.
  const isValidRange = from <= to;
  const preset = matchPreset(from, to);

  // Грузим только активную вкладку: остальные подтянутся при переключении.
  const expenses = useQuery({
    queryKey: ["reports", "expenses", from, to, mode],
    queryFn: () => reportsApi.expenses({ from_date: from, to_date: to, mode }),
    enabled: isValidRange && tab === "monthly",
  });

  const byProperty = useQuery({
    queryKey: ["reports", "by-property", from, to, mode],
    queryFn: () => reportsApi.byProperty({ from_date: from, to_date: to, mode }),
    enabled: isValidRange && tab === "properties",
  });

  const consumption = useQuery({
    queryKey: ["reports", "consumption", from, to],
    queryFn: () =>
      reportsApi.consumption({ from_date: from, to_date: to }),
    enabled: isValidRange && tab === "consumption",
  });

  // Если в отчёте несколько валют, показываем крупнейшую, чтобы суммы
  // и доли не смешивались.
  const monthlyTotals = useMemo(
    () => totalsByCurrency(expenses.data?.items ?? []),
    [expenses.data],
  );
  const monthlyCurrency = monthlyTotals[0]?.currency ?? FALLBACK_CURRENCY;
  const monthlyItems = useMemo(
    () =>
      (expenses.data?.items ?? []).filter(
        (i) => i.currency === monthlyCurrency,
      ),
    [expenses.data, monthlyCurrency],
  );

  const propertyTotals = useMemo(
    () => totalsByCurrency(byProperty.data?.items ?? []),
    [byProperty.data],
  );
  const propertyCurrency = propertyTotals[0]?.currency ?? FALLBACK_CURRENCY;
  const propertyItems = useMemo(
    () =>
      (byProperty.data?.items ?? []).filter(
        (i) => i.currency === propertyCurrency,
      ),
    [byProperty.data, propertyCurrency],
  );

  const hasMixedCurrencies =
    monthlyTotals.length > 1 || propertyTotals.length > 1;

  async function handleExport() {
    if (exporting || !isValidRange) return;
    setExporting(true);
    try {
      const csv = await reportsApi.exportCsv({
        from_date: from,
        to_date: to,
        mode,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = csvFilename(from, to);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV выгружен");
    } catch {
      toast.error("Не удалось выгрузить CSV");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отчёты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Расходы и потребление
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || !isValidRange}
          title="Выгрузить расходы по месяцам в CSV"
        >
          <Download className="size-4 mr-2" />
          {exporting ? "Выгружаем…" : "Экспорт CSV"}
        </Button>
      </div>

      <ReportFilters
        from={from}
        to={to}
        preset={preset}
        mode={mode}
        showMode={tab !== "consumption"}
        onRangeChange={(nextFrom, nextTo) =>
          setRange({ from: nextFrom, to: nextTo })
        }
        onModeChange={setMode}
      />

      {!isValidRange && (
        <p className="text-sm text-destructive">
          Начало периода позже окончания — выберите корректные даты.
        </p>
      )}

      {hasMixedCurrencies && (
        <p className="text-xs text-muted-foreground">
          В отчёте несколько валют — суммы и доли показаны только в{" "}
          {monthlyCurrency}.
        </p>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReportTab)}>
        <TabsList>
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value}>
              <Icon />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <MonthlyExpensesReport
            items={monthlyItems}
            currency={monthlyCurrency}
            isLoading={expenses.isLoading}
          />
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <ByPropertyExpensesReport
            items={propertyItems}
            currency={propertyCurrency}
            isLoading={byProperty.isLoading}
          />
        </TabsContent>

        <TabsContent value="consumption" className="mt-4">
          <ConsumptionReport
            items={consumption.data?.items ?? []}
            isLoading={consumption.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
