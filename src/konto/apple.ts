import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { kontoKlient } from "./klient";

export type InloggResultat = { ok: true } | { ok: false; avbruten: boolean; fel?: string };

export async function appleFinns(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple med iOS egen ruta. Apple lämnar en signerad ID-token
 * som servern kontrollerar. En engångskod (nonce) binder token till just
 * det här försöket: Apple får koden hashad, servern får originalet.
 */
export async function loggaInMedApple(): Promise<InloggResultat> {
  try {
    const nonce = Crypto.randomUUID();
    const hashad = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const svar = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashad,
    });
    if (!svar.identityToken) {
      return { ok: false, avbruten: false, fel: "Apple lämnade ingen inloggning. Försök igen." };
    }
    // Namnet kommer bara med första gången man loggar in med Apple.
    const fornamn = svar.fullName?.givenName ?? undefined;
    const efternamn = svar.fullName?.familyName ?? undefined;
    const { error } = await kontoKlient.signIn.social({
      provider: "apple",
      idToken: {
        token: svar.identityToken,
        nonce,
        user: fornamn || efternamn ? { name: { firstName: fornamn, lastName: efternamn } } : undefined,
      },
    });
    if (error) {
      return { ok: false, avbruten: false, fel: "Inloggningen med Apple gick inte igenom. Försök igen." };
    }
    return { ok: true };
  } catch (e) {
    const kod = (e as { code?: string } | null)?.code;
    if (kod === "ERR_REQUEST_CANCELED") {
      return { ok: false, avbruten: true };
    }
    return { ok: false, avbruten: false, fel: "Inloggningen med Apple gick inte igenom. Försök igen." };
  }
}
