/**
 * Tiny fetch wrapper that reads the JWT from localStorage and attaches it
 * to every request. Returns parsed JSON (or throws with a useful error).
 */
export async function apiCall(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const authToken = token || localStorage.getItem('auth_token');
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* keep data null */
    }
  }
  if (!res.ok) {
    const msg = data?.error || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, token) => apiCall(path, { token }),
  post: (path, body, token) => apiCall(path, { method: 'POST', body, token }),
  put: (path, body, token) => apiCall(path, { method: 'PUT', body, token }),
  del: (path, token) => apiCall(path, { method: 'DELETE', token }),
};
