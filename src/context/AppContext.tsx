import React, { createContext, useContext, useEffect, useState } from "react";
import { useCases } from "../app/composition/useCases";
import { User, SessionState, UserRole } from "../domain/entities/Session";
import { config, validateEnvironment, EnvironmentConfigurationError } from "../config/env";

export interface AppContextType {
  isInitialized: boolean;
  user: User | null;
  sessionState: SessionState;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  init: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading" });
  const [user, setUser] = useState<User | null>(null);

  async function init() {
    try {
      let envError: Error | null = null;
      try {
        validateEnvironment(config);
      } catch (e: any) {
        envError = e;
      }

      const res = await useCases.auth.getSession();
      if (res.ok) {
        setSessionState(res.data);
        if (res.data.status === "preview") {
          if (envError) throw envError; // Do not swallow config errors just because we fell back to preview!
          setUser(res.data.session.user);
          return;
        }

        if (res.data.status === "authenticated") {
          if (envError) throw envError; // Block Supabase login if misconfigured
          const userObj = res.data.session.user;
          setUser(userObj);

          if (userObj.role !== "PREVIEW") {
            const centersRes = await useCases.auth.getMyCenters?.();
            if (centersRes && centersRes.ok && centersRes.data.length > 0) {
              const { config } = await import("../config/env");
              const targetCenters = centersRes.data;
              
              if (config.branchMode === "single") {
                const hasMembership = targetCenters.some(c => c.id === config.centerId);
                if (!hasMembership) {
                  const err = new Error("UNAUTHORIZED_CENTER_MEMBERSHIP");
                  setSessionState({ status: "error", error: err });
                  setUser(null);
                  return;
                }
                localStorage.removeItem("activeCenterId");
              } else {
                let activeId = localStorage.getItem("activeCenterId");
                if (!activeId || !targetCenters.find(c => c.id === activeId)) {
                  activeId = targetCenters[0].id;
                }
                useCases.tenant.setActiveCenterId(activeId);
                localStorage.setItem("activeCenterId", activeId);
              }
            }
          }
        } else {
          // unauthenticated
          if (envError) throw envError;
          setUser(null);
        }
      } else {
        if (envError) throw envError;
        const errorRes = res as { ok: false; error: Error };
        setSessionState({ status: "error", error: errorRes.error });
        setUser(null);
      }
    } catch (error: any) {
      console.error("[AppContext] Initialization failed:", error);
      setSessionState({ status: "error", error: error as Error });
      setUser(null);
    } finally {
      setIsInitialized(true);
    }
  }

  useEffect(() => {
    void init();
  }, []);

  return (
    <AppContext.Provider value={{ isInitialized, sessionState, user, setUser, init }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
}

