import * as Linking from 'expo-linking';

/**
 * Build the URL Supabase should redirect to after a signup confirmation,
 * password recovery, or magic-link email is opened.
 *
 * - Production / dev builds: `expensetracker://auth/callback`
 * - Expo Go: `exp://<host>/--/auth/callback`
 * - Web: `<origin>/auth/callback`
 *
 * This exact URL (and the `exp://**` wildcard for Expo Go) must be added to
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function getAuthRedirectUri(): string {
  return Linking.createURL('auth/callback');
}

export interface ParsedAuthCallback {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
}

/**
 * Parse both the query string (`?code=...`, `?token_hash=...`) and the hash
 * fragment (`#access_token=...`) that Supabase can append to a redirect.
 */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback {
  const [base, hash = ''] = url.split('#');
  const queryIndex = base.indexOf('?');
  const query = queryIndex >= 0 ? base.slice(queryIndex + 1) : '';
  const params = parseParams(hash ? `${query}&${hash}` : query);

  return {
    code: params.code ?? null,
    tokenHash: params.token_hash ?? null,
    type: params.type ?? null,
    accessToken: params.access_token ?? null,
    refreshToken: params.refresh_token ?? null,
    error: params.error ?? null,
    errorDescription: params.error_description ?? null,
  };
}

/**
 * Minimal, dependency-free query/fragment parser. React Native ships an
 * incomplete `URLSearchParams` in some configurations, so auth redirects must
 * not rely on it.
 */
function parseParams(raw: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pair of raw.split('&')) {
    if (!pair) continue;

    const separator = pair.indexOf('=');
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';

    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      // Ignore malformed percent-encoding instead of crashing the app.
      continue;
    }

    if (key && result[key] === undefined) {
      result[key] = value;
    }
  }

  return result;
}

/** True when the URL looks like an auth redirect we should process. */
export function isAuthCallbackUrl(url: string): boolean {
  const parsed = parseAuthCallbackUrl(url);
  return Boolean(
    parsed.code || parsed.tokenHash || parsed.accessToken || parsed.error
  );
}
