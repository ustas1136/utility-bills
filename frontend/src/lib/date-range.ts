import { format, startOfMonth, startOfYear, subMonths } from "date-fns";

export type PeriodPreset = "month" | "3m" | "6m" | "12m" | "year" | "custom";

/**
 * Пресеты периода. Все заканчиваются сегодняшним днём.
 *
 * «Этот месяц», «3 мес», «12 мес» и «Год» выровнены по границам месяца/года,
 * чтобы в отчёте по месяцам не было обрезанных первых месяцев.
 * «6 мес» (дефолт страницы) — скользящее окно ровно от сегодняшнего дня.
 */
export const PERIOD_PRESETS: { value: Exclude<PeriodPreset, "custom">; label: string }[] =
  [
    { value: "month", label: "Этот месяц" },
    { value: "3m", label: "3 мес" },
    { value: "6m", label: "6 мес" },
    { value: "12m", label: "12 мес" },
    { value: "year", label: "Год" },
  ];

export const DEFAULT_PRESET: Exclude<PeriodPreset, "custom"> = "6m";

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Диапазон дат для пресета в формате `yyyy-MM-dd` (как ждёт API). */
export function presetRange(
  preset: Exclude<PeriodPreset, "custom">,
  today: Date = new Date(),
): { from: string; to: string } {
  const to = toISODate(today);
  switch (preset) {
    case "month":
      return { from: toISODate(startOfMonth(today)), to };
    case "3m":
      return { from: toISODate(startOfMonth(subMonths(today, 2))), to };
    case "12m":
      return { from: toISODate(startOfMonth(subMonths(today, 11))), to };
    case "year":
      return { from: toISODate(startOfYear(today)), to };
    case "6m":
    default:
      // Дефолт страницы: ровно «сегодня минус 6 месяцев», без выравнивания
      // по началу месяца.
      return { from: toISODate(subMonths(today, 6)), to };
  }
}

/**
 * Какому пресету соответствует диапазон. Если ни одному —
 * значит период задан вручную (`custom`).
 */
export function matchPreset(
  from: string,
  to: string,
  today: Date = new Date(),
): PeriodPreset {
  for (const { value } of PERIOD_PRESETS) {
    const range = presetRange(value, today);
    if (range.from === from && range.to === to) return value;
  }
  return "custom";
}
