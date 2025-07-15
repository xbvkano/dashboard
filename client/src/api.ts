export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

export async function fetchJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<any> {
  const response = await fetch(input, init);
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
