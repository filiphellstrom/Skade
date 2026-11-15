import { betterAuth } from "better-auth";
import { stadaForeRadering } from "./api.ts";
import { byggAuthAlternativ } from "./auth-alternativ.ts";
import type { Miljo } from "./miljo.ts";

type Auth = ReturnType<typeof betterAuth>;
let sparad: Auth | undefined;

/**
 * Skapas vid första anropet och inte när modulen laddas: en Worker får inte
 * prata med databasen utanför ett anrop.
 */
export function hamtaAuth(m: Miljo): Auth {
  sparad ??= betterAuth(byggAuthAlternativ(m, m.DB, (userId) => stadaForeRadering(m.DB, userId)));
  return sparad;
}
