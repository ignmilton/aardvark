/**
 * Centralized auth token retrieval.
 * Provides SSR-safe, consistent access to the stored auth token.
 *
 * The canonical storage key is 'accessToken' (set by AuthProvider).
 * Some legacy code may use 'token'; this utility checks both for
 * backward compatibility.
 */

const PRIMARY_KEY = 'accessToken';
const LEGACY_KEY = 'token';

/**
 * Get the current auth token from localStorage.
 * Returns undefined when running on the server or when no token exists.
 */
export function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(PRIMARY_KEY)
    || localStorage.getItem(LEGACY_KEY)
    || undefined;
}

/**
 * Get a short, stable identifier for the current user session.
 * Used for React Query cache key scoping so different users don't
 * share cached admin/moderation data.
 *
 * Returns undefined when no token is present.
 */
export function getSessionScope(): string | undefined {
  const token = getAuthToken();
  if (!token) return undefined;
  // Use last 8 chars of the token as a lightweight session identifier.
  // This avoids decoding the JWT while still differentiating users.
  return token.slice(-8);
}
