import { useSearchParams } from "react-router-dom";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SettingsTab =
  | "profile"
  | "notifications"
  | "reminders"
  | "family";

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "profile", label: "Профиль" },
  { value: "notifications", label: "Уведомления" },
  { value: "reminders", label: "Напоминания" },
  { value: "family", label: "Семья" },
];

interface Props {
  children: (tab: SettingsTab) => React.ReactNode;
}

export function SettingsTabs({ children }: Props) {
  const [params, setParams] = useSearchParams();
  const active = (params.get("tab") ?? "profile") as SettingsTab;

  const handleChange = (value: string) => {
    setParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      <Tabs value={active} onValueChange={handleChange}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div>{children(active)}</div>
    </div>
  );
}