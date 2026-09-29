import { Droplet, FileText, Plus, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

const ACTIONS = [
  {
    to: "/properties",
    label: "Передать показания",
    hint: "Счётчики электричества, воды, газа",
    icon: Droplet,
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  {
    to: "/charges",
    label: "Оплатить",
    hint: "Ближайшие и просроченные платежи",
    icon: Receipt,
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  {
    to: "/properties",
    label: "Добавить объект",
    hint: "Квартира, дом, участок, авто",
    icon: Plus,
    color: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  },
  {
    to: "/reports",
    label: "Отчёты",
    hint: "Расходы за период, потребление",
    icon: FileText,
    color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.label}
          to={a.to}
          className="group rounded-xl border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors"
        >
          <div
            className={`size-9 rounded-lg ${a.color} flex items-center justify-center`}
          >
            <a.icon className="size-4" />
          </div>
          <div className="mt-3 font-medium text-sm">{a.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {a.hint}
          </div>
        </Link>
      ))}
    </div>
  );
}