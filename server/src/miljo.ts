/** Bindningar och variabler för Workern (se wrangler.jsonc). */
export interface Miljo {
  DB: D1Database;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  WEBB_URL: string;
  /** Extra tillåtna webbadresser vid lokal utveckling, kommaseparerade. */
  EXTRA_ORIGINS?: string;
  APPLE_BUNDLE_ID: string;
  APPLE_TEAM_ID: string;
  /** Services ID för Sign in with Apple på webben. */
  APPLE_CLIENT_ID?: string;
  APPLE_KEY_ID?: string;
  /** Innehållet i .p8-filen. */
  APPLE_PRIVATE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Slår på e-post + lösenord. Bara för lokala tester, aldrig i drift. */
  TESTLAGE?: string;
}

export function appleWebbKlar(m: Miljo): boolean {
  return Boolean(m.APPLE_CLIENT_ID && m.APPLE_KEY_ID && m.APPLE_PRIVATE_KEY);
}

export function googleKlar(m: Miljo): boolean {
  return Boolean(m.GOOGLE_CLIENT_ID && m.GOOGLE_CLIENT_SECRET);
}

export function tillatnaOrigins(m: Miljo): string[] {
  const extra = (m.EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [m.WEBB_URL, ...extra];
}
