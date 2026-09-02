import { AuthRepository, Result, AuthError } from "../../../domain/ports/repositories";
import { SessionState } from "../../../domain/entities/Session";
import { getSupabaseClient } from ".././client";
import { mapAuthSession } from ".././mappers";
import { passwordResetRedirectUrl } from "../../../shared/auth/passwordResetRedirect";
import { emailField } from "../../../domain/validation";
import { okValue, createAuthError } from "./shared";

export class SupabaseAuthAdapter implements AuthRepository {
  async login(username: string, password: string): Promise<Result<SessionState, AuthError>> {
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (error) {
         if (error.message.toLowerCase().includes("invalid login credentials")) {
             return { ok: false, error: createAuthError("INVALID_CREDENTIALS", "Invalid credentials") };
         }
         return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      
      const sessionState = mapAuthSession(data.session);
      if (sessionState.status === "error") {
          return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", sessionState.error.message) };
      }
      
      return { ok: true, data: sessionState };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
  
  async logout(): Promise<Result<void, AuthError>> {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
  
  onAuthStateChange(callback: (event: string) => void): () => void {
    const { data } = getSupabaseClient().auth.onAuthStateChange((event) => {
      callback(event);
    });
    return () => data.subscription.unsubscribe();
  }

  async getSession(): Promise<Result<SessionState, AuthError>> {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      const sessionState = mapAuthSession(data.session);
      if (sessionState.status === "error") {
        // A cached access token can predate a server-side role change. Clear
        // this unusable local session so the login form remains available.
        await getSupabaseClient().auth.signOut({ scope: "local" });
        return { ok: true, data: { status: "anonymous" } };
      }
      return { ok: true, data: sessionState };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }

  async requestPasswordReset(email: string): Promise<Result<void, AuthError>> {
    const emailR = emailField(email, { required: true });
    if (!emailR.ok || !okValue(emailR)) {
      return { ok: false, error: createAuthError("INVALID_CREDENTIALS", "validation.email_invalid") };
    }
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(okValue(emailR) as string, {
        redirectTo: passwordResetRedirectUrl(),
      });
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }

  async updatePassword(newPassword: string): Promise<Result<void, AuthError>> {
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return { ok: false, error: createAuthError("INVALID_CREDENTIALS", "Password is required") };
    }
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      return { ok: true, data: undefined };
    } catch (e: unknown) {
      return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }

  async getMyCenters(): Promise<Result<{ id: string; name: string; role: "ADMIN" | "MANAGER" | "STAFF" }[], AuthError>> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('center_memberships')
        .select(`
          center_id,
          role,
          centers (
            name
          )
        `);
      if (error) {
         return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", error.message) };
      }
      const mapped = data.flatMap((d: any) => {
        const role = String(d.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "MANAGER" && role !== "STAFF") return [];
        return [{
          id: d.center_id,
          name: d.centers?.name || 'Unknown Center',
          role: role as "ADMIN" | "MANAGER" | "STAFF",
        }];
      }).sort((a, b) => a.name.localeCompare(b.name));
      return { ok: true, data: mapped };
    } catch (e: unknown) {
       return { ok: false, error: createAuthError("INFRASTRUCTURE_ERROR", (e as Error).message) };
    }
  }
}
