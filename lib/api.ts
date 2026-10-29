/* Client for the HRMS backend (gs-hrms-backend). Requests go to /api/* on this origin (proxied in next.config.ts), so the
   httpOnly session cookie is sent automatically and the browser adds the Origin header the backend checks on writes.
   The contract is docs/api/openapi.json in the backend repo. */

/** The backend's error body: switch on `code`, show `message`, quote `requestId` when reporting a problem. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined>;

// Set by lib/auth.ts: a 401 outside the sign-in calls means the session ended (idle timeout, signed out elsewhere,
// role changed), so the app returns to the sign-in page.
let unauthorized: (() => void) | null = null;
export const onUnauthorized = (handler: () => void) => {
  unauthorized = handler;
};

export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, query?: Query): Promise<T> {
  const qs = query ? new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]]))).toString() : '';
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs ? `?${qs}` : ''}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network.unreachable', 'The HRMS server cannot be reached. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) unauthorized?.();
    const e = (data ?? {}) as { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string };
    throw new ApiError(res.status, e.code ?? 'server.error', e.message ?? 'Something went wrong', e.details, e.requestId);
  }
  return data as T;
}

/** A message for the user. Validation errors (`request.invalid`) list their messages in `details.fields`. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  const fields = e.details?.fields;
  if (e.code === 'request.invalid' && Array.isArray(fields)) return fields.join('. ');
  return e.message;
}
