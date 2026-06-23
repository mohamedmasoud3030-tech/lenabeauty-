import React, { createContext, useContext, useMemo } from "react";
import { useCases } from "./app/composition/useCases";
import { unwrap } from "./shared/hooks/useApplication";
import { SessionState, User } from "./domain/entities/Session";
import { useAppContext } from "./context/AppContext";

type Session = User | null;

const Ctx = createContext<{
  me: Session;
  refresh: () => Promise<void>;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  me: null,
  refresh: async () => {},
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: me, init, applyAuthenticatedSession } = useAppContext();

  async function refresh() {
    await init();
  }

  async function login(username: string, password: string) {
    const sessionState = await unwrap<SessionState>(useCases.auth.login(username, password));
    await applyAuthenticatedSession(sessionState);
  }

  async function logout() {
    await unwrap(useCases.auth.logout());
    await init();
  }

  const value = useMemo(() => ({ me, refresh, login, logout }), [me, init]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
