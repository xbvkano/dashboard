export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

const skipNgrokWarning =
  import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1';

/** Attach x-user-id (and optional x-user-name) for CRM / messaging APIs */
export function attachDashboardUserHeaders(headers: Headers): void {
  try {
    const uid = localStorage.getItem('userId')
    if (uid && /^\d+$/.test(uid)) {
      headers.set('x-user-id', uid)
    }
    const userName = localStorage.getItem('userName')
    if (userName) {
      headers.set('x-user-name', userName)
    }
  } catch {
    /* ignore */
  }
}

export async function fetchJson(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<any> {
  const headers = new Headers(init.headers);
  attachDashboardUserHeaders(headers)
  if (skipNgrokWarning) {
    headers.set('ngrok-skip-browser-warning', '1');
  }
  const response = await fetch(input, { ...init, headers });
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
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
}
