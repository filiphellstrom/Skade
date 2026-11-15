import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { API_URL, APP_SCHEMA } from "./konfig";

/**
 * Inloggningsklienten i appen. Sessionen sparas i telefonens nyckelring
 * (expo-secure-store) och skickas med i anropen till servern.
 * Webben har en egen variant i klient.web.ts (kakor i webbläsaren).
 */
export const kontoKlient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: APP_SCHEMA, storagePrefix: APP_SCHEMA, storage: SecureStore })],
});

/**
 * Det som ska med i egna anrop till servern (jaktlag m.m.) för att de ska
 * räknas som inloggade: i appen skickas sessionskakan med för hand.
 */
export async function inloggadeAnrop(): Promise<{
  headers: Record<string, string>;
  credentials: RequestCredentials;
}> {
  const kaka = await kontoKlient.getCookie();
  return { headers: kaka ? { Cookie: kaka } : {}, credentials: "omit" };
}
