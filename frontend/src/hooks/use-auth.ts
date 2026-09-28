import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { authApi, type LoginPayload, type RegisterPayload } from "@/api/auth";
import { HttpError } from "@/api/client";
import { useAuthStore } from "@/store/auth";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: LoginPayload) => {
      const tokens = await authApi.login(data);
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    onSuccess: (user) => {
      toast.success(`Добро пожаловать, ${user.full_name ?? user.email}`);
      navigate("/", { replace: true });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 401) {
        toast.error("Неверный email или пароль");
      } else {
        toast.error("Ошибка входа. Попробуйте позже.");
      }
    },
  });
}

export function useRegister() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: RegisterPayload) => {
      await authApi.register(data);
      const tokens = await authApi.login({
        email: data.email,
        password: data.password,
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    onSuccess: (user) => {
      toast.success(`Аккаунт создан. Привет, ${user.email}!`);
      navigate("/", { replace: true });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        toast.error("Email уже зарегистрирован");
      } else {
        toast.error("Не удалось зарегистрироваться");
      }
    },
  });
}