import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import {
  invitationsApi,
  type HouseholdRole,
  type InvitationCreate,
} from "@/api/household-members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  householdId: number;
}

const ROLES: { value: InvitationCreate["role"]; label: string; hint: string }[] =
  [
    {
      value: "admin",
      label: "Администратор",
      hint: "Может управлять объектами, услугами и участниками",
    },
    {
      value: "member",
      label: "Участник",
      hint: "Может вносить показания и оплачивать",
    },
    {
      value: "viewer",
      label: "Наблюдатель",
      hint: "Только просмотр",
    },
  ];

export function InviteMemberDialog({ householdId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationCreate["role"]>("member");

  // Токен созданного приглашения — чтобы показать ссылку
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRole("member");
      setCreatedToken(null);
      setCopied(false);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      invitationsApi.create(householdId, { email, role }),
    onSuccess: (inv) => {
      toast.success("Приглашение создано");
      queryClient.invalidateQueries({
        queryKey: ["invitations", householdId],
      });
      // Если backend возвращает token — сохраняем для показа ссылки
      const token = (inv as unknown as { token?: string }).token;
      if (token) {
        setCreatedToken(token);
      } else {
        setOpen(false);
      }
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        toast.error("Этот пользователь уже участник");
      } else if (error instanceof HttpError && error.status === 422) {
        toast.error("Проверьте email");
      } else {
        toast.error("Не удалось создать приглашение");
      }
    },
  });

  const inviteUrl = createdToken
    ? `${window.location.origin}/invite/${createdToken}`
    : "";

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Пригласить
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Приглашение в семью</DialogTitle>
          <DialogDescription>
            Отправьте ссылку — пользователь сможет присоединиться к вашему
            household.
          </DialogDescription>
        </DialogHeader>

        {!createdToken ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label>Роль</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setRole(v as InvitationCreate["role"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  {ROLES.find((r) => r.value === role)?.hint}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !email}
              >
                {create.isPending ? "Создаём…" : "Создать приглашение"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/50 p-3">
                <Label className="text-xs text-muted-foreground">
                  Ссылка для {email}
                </Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    readOnly
                    value={inviteUrl}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyUrl}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Приглашение действует 7 дней. Пользователь должен войти в
                приложение под email <b>{email}</b> — иначе присоединиться не
                получится.
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Готово</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}