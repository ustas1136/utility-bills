import { HouseholdsTab } from "@/components/settings/HouseholdsTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { RemindersTab } from "@/components/settings/RemindersTab";
import { SettingsTabs, type SettingsTab } from "@/components/settings/SettingsTabs";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Профиль, уведомления, напоминания и семья
        </p>
      </div>

      <SettingsTabs>
        {(tab: SettingsTab) => {
          switch (tab) {
            case "profile":
              return <ProfileTab />;
            case "notifications":
              return <NotificationsTab />;
            case "reminders":
              return <RemindersTab />;
            case "family":
              return <HouseholdsTab />;
            default:
              return <ProfileTab />;
          }
        }}
      </SettingsTabs>
    </div>
  );
}