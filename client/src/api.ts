export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

export async function fetchJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<any> {
  const response = await fetch(input, init);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Expected JSON but received:', text);
    throw err;
  }
}
