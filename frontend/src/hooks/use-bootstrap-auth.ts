import { useEffect, useState } from "react";

import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/auth";

export function useBootstrapAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!accessToken) {
        setReady(true);
        return;
      }
      try {
        const user = await authApi.me();
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [accessToken, setUser, logout]);

  return ready;
}