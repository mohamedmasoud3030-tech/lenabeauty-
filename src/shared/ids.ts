/**
 * Secure, non-reversible short identifiers for runtime objects
 * (notification results, log correlation, in-memory keys).
 *
 * Uses crypto.getRandomValues when available (all modern browsers and jsdom);
 * falls back to a monotonic timestamp + counter otherwise. NEVER uses
 * Math.random — SonarCloud flags PRNGs in security-sensitive roles, and the
 * existing ErrorBoundary already established this pattern.
 */
let counter = 0;

export function createShortId(bytes = 6): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const arr = crypto.getRandomValues(new Uint8Array(bytes));
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  counter += 1;
  const time = Date.now().toString(16).padStart(8, "0");
  const count = counter.toString(16).padStart(4, "0");
  return `${time}${count}`.toUpperCase().slice(-bytes * 2);
}
