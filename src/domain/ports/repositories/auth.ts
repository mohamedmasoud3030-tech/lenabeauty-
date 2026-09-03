import { SessionState } from "../../entities/Session";
import { AuthError, Result } from "./shared";

export interface AuthRepository {
  login(username: string, password: string): Promise<Result<SessionState, AuthError>>;
  logout(): Promise<Result<void, AuthError>>;
  getSession(): Promise<Result<SessionState, AuthError>>;
  onAuthStateChange(callback: (event: string) => void): () => void;
  getMyCenters(): Promise<Result<{ id: string; name: string; role: "ADMIN" | "MANAGER" | "STAFF" }[], AuthError>>;
  /** Sends a recovery email. Always succeeds to the caller on a valid address format so emails cannot be enumerated. */
  requestPasswordReset(email: string): Promise<Result<void, AuthError>>;
  /** Sets a new password for the current recovery (or signed-in) session. */
  updatePassword(newPassword: string): Promise<Result<void, AuthError>>;
}
