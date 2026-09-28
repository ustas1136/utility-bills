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
import { useLogin } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: FormValues) => login.mutate(values);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Левая колонка — брендинг */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
            <Wallet className="size-5" />
          </div>
          <span className="font-semibold text-lg">Utility Bills</span>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Все коммунальные платежи — в одном месте
          </h1>
          <p className="text-white/80 leading-relaxed">
            Квартиры, дома, участки, автомобили, налоги и страховки. Учёт
            показаний, автоматический расчёт, напоминания о сроках и понятные
            отчёты.
          </p>
          <ul className="space-y-2 text-sm text-white/90">
            <li>✓ Единый дашборд по всем объектам</li>
            <li>✓ Напоминания о предстоящих платежах</li>
            <li>✓ Совместный доступ для семьи</li>
          </ul>
        </div>

        <div className="text-white/60 text-xs">
          v0.1.0 · personal project
        </div>
      </div>

      {/* Правая колонка — форма */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <div className="size-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Wallet className="size-5" />
            </div>
            <span className="font-semibold text-lg">Utility Bills</span>
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">Вход</h2>
            <p className="text-sm text-muted-foreground">
              Войдите, чтобы продолжить
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        autoComplete="current-password"
                        placeholder="••••••••"
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
                disabled={login.isPending}
              >
                {login.isPending ? "Входим…" : "Войти"}
              </Button>
            </form>
          </Form>

          <div className="text-sm text-center text-muted-foreground">
            Нет аккаунта?{" "}
            <Link
              to="/register"
              className="text-primary hover:underline font-medium"
            >
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}