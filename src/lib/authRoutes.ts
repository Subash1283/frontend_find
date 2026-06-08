export const AUTH_CALLBACK_PATH = '/auth/callback';

export function parseUserFromOAuthQuery(encoded: string | null): Record<string, unknown> | null {
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(encoded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
