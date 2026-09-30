import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d MMM yyyy", { locale: ru });
}

/** Показания счётчиков: до трёх знаков после запятой. */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRelative(date: string): string {
  return formatDistanceToNow(parseISO(date), {
    addSuffix: true,
    locale: ru,
  });
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return `просрочен на ${Math.abs(days)} д.`;
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 5) return `через ${days} д.`;
  return `через ${days} дн.`;
}