// Anonymous demo-workspace capability; never a production staff credential.
// Use an explicit header because embedded browsers may not return app cookies.
const KEY = 'findtogether.demo-session';
let memoryToken: string | null = null;
export function getDemoToken(): string | null {
  try { return sessionStorage.getItem(KEY) ?? memoryToken; } catch { return memoryToken; }
}
export function setDemoToken(token: string | null) {
  memoryToken = token;
  try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch { /* memory supports storage-disabled browsers */ }
}
export function demoHeaders(): Record<string, string> {
  const token = getDemoToken();
  return token ? { 'X-Findtogether-Session': token } : {};
}
export function expireDemoSession(expectedToken: string | null = getDemoToken()) {
  if (getDemoToken() !== expectedToken) return;
  setDemoToken(null);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('findtogether-session-expired'));
}
