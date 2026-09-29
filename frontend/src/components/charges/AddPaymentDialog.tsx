import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { chargesApi, type ChargeRead, type PaymentMethod } from "@/api/charges";
import { HttpError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { formatMoney } from "@/lib/format";

interface Props {
  charge: ChargeRead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "bank_transfer", label: "Перевод" },
  { value: "online", label: "Онлайн" },
  { value: "other", label: "Другое" },
];

export function AddPaymentDialog({ charge, open, onOpenChange }: Props) {
  const remaining = Math.max(
    Number(charge.amount) - Number(charge.paid_amount),
    0,
  );
  const [amount, setAmount] = useState(String(remaining.toFixed(2)));
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [comment, setComment] = useState("");

  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      chargesApi.addPayment(charge.id, {
        amount,
        currency: charge.currency,
        paid_at: new Date().toISOString(),
        method,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Платёж добавлен");
      queryClient.invalidateQueries({ queryKey: ["charges"] });
      queryClient.invalidateQueries({ queryKey: ["charge", charge.id] });
      queryClient.invalidateQueries({ queryKey: ["bff", "home"] });
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 422) {
        toast.error("Проверьте сумму и валюту");
      } else {
        toast.error("Не удалось добавить платёж");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Оплата</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма начисления</span>
              <span className="font-medium tabular-nums">
                {formatMoney(charge.amount, charge.currency)}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Оплачено</span>
              <span className="font-medium tabular-nums">
                {formatMoney(charge.paid_amount, charge.currency)}
              </span>
            </div>
            <div className="flex justify-between mt-1 pt-1 border-t border-border/50">
              <span className="text-muted-foreground">К оплате</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(remaining, charge.currency)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">
              Сумма ({charge.currency})
            </Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Способ оплаты</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-comment">Комментарий (необязательно)</Label>
            <Input
              id="pay-comment"
              placeholder="Чек №1234"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Проводим…" : "Оплатить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}