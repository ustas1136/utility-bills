import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Shield, Trash2, User, Eye } from "lucide-react";
import { toast } from "sonner";

import {
  membersApi,
  type HouseholdMember,
  type HouseholdRole,
} from "@/api/household-members";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";

interface Props {
  member: HouseholdMember;
  householdId: number;
  currentUserRole: HouseholdRole;
  memberEmail?: string;
}

const ROLE_CONFIG: Record<
  HouseholdRole,
  { label: string; icon: typeof User; color: string }
> = {
  owner: {
    label: "Владелец",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
  },
  admin: {
    label: "Администратор",
    icon: Shield,
    color: "text-blue-600 dark:text-blue-400",
  },
  member: {
    label: "Участник",
    icon: User,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  viewer: {
    label: "Наблюдатель",
    icon: Eye,
    color: "text-muted-foreground",
  },
};

export function MemberRow({
  member,
  householdId,
  currentUserRole,
  memberEmail,
}: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const cfg = ROLE_CONFIG[member.role];
  const Icon = cfg.icon;
  const isMe = member.user_id === currentUserId;
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = member.role === "owner";

  const updateRole = useMutation({
    mutationFn: (newRole: HouseholdRole) =>
      membersApi.updateRole(householdId, member.user_id, newRole),
    onSuccess: () => {
      toast.success("Роль изменена");
      queryClient.invalidateQueries({
        queryKey: ["members", householdId],
      });
    },
    onError: () => toast.error("Не удалось изменить роль"),
  });

  const remove = useMutation({
    mutationFn: () =>
      membersApi.remove(householdId, member.user_id),
    onSuccess: () => {
      toast.success("Участник удалён");
      queryClient.invalidateQueries({
        queryKey: ["members", householdId],
      });
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  const initials = memberEmail?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="flex items-center gap-4 py-4">
      <Avatar className="size-10 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {memberEmail ?? `Пользователь #${member.user_id}`}
          </span>
          {isMe && (
            <Badge variant="outline" className="text-xs font-normal">
              вы
            </Badge>
          )}
        </div>
        <div className={`text-xs mt-0.5 flex items-center gap-1.5 ${cfg.color}`}>
          <Icon className="size-3" />
          {cfg.label}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Селектор роли: показываем, если можем управлять и это не owner */}
        {canManage && !isOwner && !isMe && (
          <Select
            value={member.role}
            onValueChange={(v) => updateRole.mutate(v as HouseholdRole)}
            disabled={updateRole.isPending}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Администратор</SelectItem>
              <SelectItem value="member">Участник</SelectItem>
              <SelectItem value="viewer">Наблюдатель</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Удаление: owner может убрать кого угодно, кроме себя;
            остальные — только себя */}
        {!isOwner && (canManage || isMe) && (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive size-9"
            onClick={() => {
              const msg = isMe
                ? "Выйти из семьи?"
                : "Удалить участника?";
              if (confirm(msg)) remove.mutate();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}