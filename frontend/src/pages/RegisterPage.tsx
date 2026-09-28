import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/hooks/use-auth";

const schema = z.object({
  full_name: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Некорректный email"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .max(128, "Слишком длинный пароль"),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const register = useRegister();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const onSubmit = (values: FormValues) =>
    register.mutate({
      email: values.email,
      password: values.password,
      full_name: values.full_name || undefined,
    });

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <span className="font-semibold text-lg">Utility Bills</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Заведите порядок в платежах за 5 минут
          </h1>
          <p className="text-white/80 leading-relaxed">
            Добавьте квартиру, дом, участок и автомобиль — и забудьте про
            бумажные квитанции. Приложение подскажет, что и когда оплатить.
          </p>
          <ul className="space-y-2 text-sm text-white/90">
            <li>✓ Бесплатно, без рекламы</li>
            <li>✓ Данные только у вас</li>
            <li>✓ Пригласите семью для совместного учёта</li>
          </ul>
        </div>

        <div className="text-white/60 text-xs">
          v0.1.0 · personal project
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Wallet className="size-5" />
            </div>
            <span className="font-semibold text-lg">Utility Bills</span>
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">
              Регистрация
            </h2>
            <p className="text-sm text-muted-foreground">
              Создайте личный аккаунт
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя (необязательно)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        autoComplete="name"
                        placeholder="Иван"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Минимум 8 символов"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={register.isPending}
              >
                {register.isPending ? "Создаём…" : "Создать аккаунт"}
              </Button>
            </form>
          </Form>

          <div className="text-sm text-center text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}