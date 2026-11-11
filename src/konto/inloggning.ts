import { Platform } from "react-native";
import { kontoKlient } from "./klient";
import { API_URL } from "./konfig";
import type { InloggResultat } from "./apple";

export { appleFinns, loggaInMedApple } from "./apple";
export type { InloggResultat } from "./apple";

/** Vilka inloggningssätt servern har uppsatta just nu. */
export interface KontoKonfig {
  apple: { app: boolean; webb: boolean };
  google: boolean;
}

/** null = servern gick inte att nå (t.ex. ingen täckning). */
export async function hamtaKontoKonfig(): Promise<KontoKonfig | null> {
  const avbryt = new AbortController();
  const timer = setTimeout(() => avbryt.abort(), 8000);
  try {
    const svar = await fetch(`${API_URL}/api/konfig`, { signal: avbryt.signal });
    if (!svar.ok) {
      return null;
    }
    return (await svar.json()) as KontoKonfig;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Dit inloggningen kommer tillbaka: profilsidan i appen eller på webben. */
function tillbakaAdress(): string {
  return Platform.OS === "web" ? `${globalThis.location.origin}/profil` : "/profil";
}

export async function loggaInMedGoogle(): Promise<InloggResultat> {
  try {
    const { error } = await kontoKlient.signIn.social({
      provider: "google",
      callbackURL: tillbakaAdress(),
    });
    if (error) {
      return { ok: false, avbruten: false, fel: "Inloggningen med Google gick inte igenom. Försök igen." };
    }
    return { ok: true };
  } catch {
    return { ok: false, avbruten: false, fel: "Inloggningen med Google gick inte igenom. Försök igen." };
  }
}

/** Kopplar ett Google-konto till det inloggade kontot, så samma konto nås från webben. */
export async function kopplaGoogle(): Promise<InloggResultat> {
  try {
    const { error } = await kontoKlient.linkSocial({
      provider: "google",
      callbackURL: tillbakaAdress(),
    });
    if (error) {
      return { ok: false, avbruten: false, fel: "Kunde inte koppla Google-kontot. Försök igen." };
    }
    return { ok: true };
  } catch {
    return { ok: false, avbruten: false, fel: "Kunde inte koppla Google-kontot. Försök igen." };
  }
}

export async function loggaUt(): Promise<boolean> {
  try {
    const { error } = await kontoKlient.signOut();
    return !error;
  } catch {
    return false;
  }
}

export type RaderaResultat = "raderat" | "logga-in-igen" | "fel";

/**
 * Raderar kontot och allt som hör till det på servern. Servern kräver en
 * inloggning som är högst ett dygn gammal, annars får man logga in igen
 * först. Det som ligger i telefonen (drev, hundar, dokument) rörs inte.
 */
export async function raderaKonto(): Promise<RaderaResultat> {
  try {
    const { error } = await kontoKlient.deleteUser();
    if (!error) {
      return "raderat";
    }
    return error.code === "SESSION_EXPIRED" ? "logga-in-igen" : "fel";
  } catch {
    return "fel";
  }
}
