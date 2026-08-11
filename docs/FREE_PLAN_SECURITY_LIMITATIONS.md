# Free Plan Security Limitations — Lena Beauty

## Leaked Password Protection

Supabase Security Advisor reports **Leaked Password Protection Disabled** for the current project.

This is a **known platform-plan limitation and is NOT a release blocker for the current free-plan Demo/Staging environment**.

Official Supabase documentation states that leaked-password protection (HaveIBeenPwned password checks) is available on the **Pro Plan and above**. The current Lena Beauty project is intentionally running on the Free plan, so this control cannot be enabled without upgrading the Supabase plan.

### Risk treatment

- Status: **Accepted / Non-blocking on Free plan**.
- Scope: current Demo/Staging project and free-plan pilot usage.
- Compensating controls already present:
  - Supabase Auth password hashing (bcrypt).
  - Authenticated-only staff application surface.
  - RLS tenant isolation.
  - Membership checks inside privileged RPCs.
  - Fixed function `search_path`.
  - Least-privilege RPC grants.
  - Anonymous public-table grants removed.
  - Public booking/client-portal RPC grants disabled until that feature is intentionally released.
- Upgrade action: when the project moves to Supabase Pro or above, enable Leaked Password Protection and re-run Security Advisor.

This advisory must remain visible in security reviews, but **must not by itself prevent merge, Demo/Staging operation, or a controlled pilot while the project remains on the Free plan**.
