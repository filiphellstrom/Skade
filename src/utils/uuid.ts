import * as Crypto from "expo-crypto";

/**
 * Genererar ett UUID v4 för användning som primärnyckel. Görs på klienten
 * (inte autoincrement i databasen) så att poster kan skapas offline och
 * senare synkas till Supabase utan ID-kollisioner mellan enheter.
 */
export function randomUUID(): string {
  return Crypto.randomUUID();
}
