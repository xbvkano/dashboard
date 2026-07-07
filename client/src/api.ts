import { isNgrokBrowserContext } from './ngrokHost'

export { isNgrokBrowserContext, isNgrokHostname } from './ngrokHost'

/**
 * API origin for fetch(). On ngrok we use same-origin `/api` (Vite proxies to :3000)
 * so HTTPS pages are not blocked from calling http://localhost:3000 (mixed content).
 */
export function resolveApiBaseUrl(): string {
  if (isNgrokBrowserContext()) {
    return '/api'
  }
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (configured?.trim()) {
    return configured.trim().replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000`
  }
  return 'http://localhost:3000'
}

export const API_BASE_URL = resolveApiBaseUrl()

export const API_ACCESS_TOKEN_KEY = 'apiAccessToken';

export type AuthRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE';

export type LoginResponse = {
  role?: string;
  user?: { id?: number; safe?: boolean; userName?: string };
  userName?: string;
  accessToken?: string;
};

/** Persist POST /login response (password, Google, or NO_AUTH auto-login). */
export function persistLoginResponse(
  data: LoginResponse,
  loginMethod: 'password' | 'google' | 'dev',
): AuthRole | null {
  if (data.role !== 'ADMIN' && data.role !== 'OWNER' && data.role !== 'EMPLOYEE') {
    return null;
  }
  localStorage.setItem('role', data.role);
  localStorage.setItem('loginMethod', loginMethod);
  if (data.user && typeof data.user.safe !== 'undefined') {
    localStorage.setItem('safe', data.user.safe ? 'true' : 'false');
  }
  if (data.user?.id != null) {
    localStorage.setItem('userId', String(data.user.id));
  }
  const name = data.userName ?? data.user?.userName;
  if (name) {
    localStorage.setItem('userName', name);
  }
  if (typeof data.accessToken === 'string') {
    localStorage.setItem(API_ACCESS_TOKEN_KEY, data.accessToken);
  }
  localStorage.removeItem('signedOut');
  return data.role;
}

export function loginRequestHeaders(): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (shouldSendNgrokSkipHeader()) {
    headers.set('ngrok-skip-browser-warning', '1');
  }
  return headers;
}

function shouldSendNgrokSkipHeader(): boolean {
  return (
    import.meta.env.VITE_NGROK === 'true' ||
    import.meta.env.VITE_NGROK === '1' ||
    isNgrokBrowserContext()
  )
}

let authExpiredHandler: (() => void) | null = null;

/** Called from Dashboard mount so fetchJson can clear session + update React role state. */
export function setAuthExpiredHandler(handler: (() => void) | null): void {
  authExpiredHandler = handler;
}

/** Same keys as manual sign-out (Employee / Account). */
export function clearAuthStorage(): void {
  try {
    localStorage.removeItem('role');
    localStorage.removeItem('safe');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('loginMethod');
    localStorage.removeItem(API_ACCESS_TOKEN_KEY);
    localStorage.setItem('signedOut', 'true');
  } catch {
    /* ignore */
  }
}

function notifyAuthExpired(): void {
  clearAuthStorage();
  try {
    authExpiredHandler?.();
  } catch {
    /* ignore */
  }
}

/** Bearer JWT from POST /login (server-signed; secrets stay on server). */
export function attachApiAuthHeaders(headers: Headers): void {
  try {
    const t = localStorage.getItem(API_ACCESS_TOKEN_KEY);
    if (t) {
      headers.set('Authorization', `Bearer ${t}`);
    }
  } catch {
    /* ignore */
  }
}

/** Use with raw `fetch` to `/login` alternatives: merges Authorization into RequestInit.headers. */
export function withApiAuth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers ?? undefined);
  attachApiAuthHeaders(headers);
  return { ...init, headers };
}

/** Attach x-user-id (and optional x-user-name) for CRM / messaging APIs */
export function attachDashboardUserHeaders(headers: Headers): void {
  try {
    const uid = localStorage.getItem('userId');
    if (uid && /^\d+$/.test(uid)) {
      headers.set('x-user-id', uid);
    }
    const userName = localStorage.getItem('userName');
    if (userName) {
      headers.set('x-user-name', userName);
    }
  } catch {
    /* ignore */
  }
}

export async function refreshAccessTokenFromApi(): Promise<boolean> {
  const headers = new Headers();
  attachApiAuthHeaders(headers);
  if (shouldSendNgrokSkipHeader()) {
    headers.set('ngrok-skip-browser-warning', '1');
  }
  try {
    const res = await fetch(`${resolveApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken?: string };
    if (typeof data.accessToken !== 'string') return false;
    localStorage.setItem(API_ACCESS_TOKEN_KEY, data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function fetchJson(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<any> {
  const run = async (canRefreshOn401: boolean): Promise<any> => {
    const headers = new Headers(init.headers);
    attachApiAuthHeaders(headers);
    attachDashboardUserHeaders(headers);
    if (shouldSendNgrokSkipHeader()) {
      headers.set('ngrok-skip-browser-warning', '1');
    }
    const response = await fetch(input, { ...init, headers });
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (response.status === 401 && canRefreshOn401) {
      const refreshed = await refreshAccessTokenFromApi();
      if (refreshed) return run(false);
      notifyAuthExpired();
    }

    if (!response.ok) {
      console.error('Request failed', response.status, text);
      throw new Error(text || `Request failed with status ${response.status}`);
    }
    if (!contentType.includes('application/json')) {
      console.error('Expected JSON but received:', text);
      throw new Error('Invalid JSON response');
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Failed to parse JSON:', text);
      throw err;
    }
  };

  return run(true);
}
