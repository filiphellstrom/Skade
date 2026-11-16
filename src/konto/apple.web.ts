import { kontoKlient } from "./klient";

export type InloggResultat = { ok: true } | { ok: false; avbruten: boolean; fel?: string };

/** På webben finns Apple bara om servern har Apples webbuppgifter (se /api/konfig). */
export async function appleFinns(): Promise<boolean> {
  return true;
}

/** Skickar webbläsaren till Apple; den kommer tillbaka inloggad (profilsidan om inget annat anges). */
export async function loggaInMedApple(tillbaka = "/profil"): Promise<InloggResultat> {
  const { error } = await kontoKlient.signIn.social({
    provider: "apple",
    callbackURL: `${globalThis.location.origin}${tillbaka}`,
  });
  if (error) {
    return { ok: false, avbruten: false, fel: "Inloggningen med Apple gick inte igenom. Försök igen." };
  }
  return { ok: true };
}
