import { BarChart3, Building2, LayoutDashboard, Receipt } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Главная", icon: LayoutDashboard, end: true },
  { to: "/properties", label: "Объекты", icon: Building2 },
  { to: "/charges", label: "Платежи", icon: Receipt },
  { to: "/reports", label: "Отчёты", icon: BarChart3 },
];

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="grid grid-cols-4 h-16">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                isActive ? "text-primary font-medium" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}