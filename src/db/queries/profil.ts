import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "../../utils/uuid";
import type { Profil, Uuid } from "../types";

/**
 * Appen har bara en (1) profil per installation - inget inloggat läge,
 * ingen profilväljare (beslutat 2026-08-23, se ändringslogg i chatten
 * "Skade – Sprint 1"). Denna funktion garanterar att en Profil-rad alltid
 * finns: hämtar den första (och enda) raden om den redan finns, annars
 * skapas en ny med tomt namn.
 *
 * Ett tomt `namn` är signalen appen använder för att avgöra om
 * förstagångs-onboardingen (se OnboardingScreen) ska visas - se
 * uppdateraProfilNamn(). Anropas från app/_layout.tsx direkt efter att
 * databasen är redo, innan några skärmar renderas, så att profilId alltid
 * finns tillgängligt för resten av appen.
 */
export async function hamtaEllerSkapaProfil(
  db: SQLiteDatabase,
): Promise<Profil> {
  const existing = await db.getFirstAsync<Profil>(
    "SELECT * FROM Profil LIMIT 1",
  );
  if (existing) {
    return existing;
  }

  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.runAsync(
    "INSERT INTO Profil (id, namn, mailadress, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)",
    [id, "", now, now],
  );

  return {
    id,
    namn: "",
    mailadress: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sätter profilens namn - anropas av OnboardingScreen när användaren
 * fyller i sitt namn första gången appen körs. Ett icke-tomt namn är det
 * som gör att onboarding-gaten i app/_layout.tsx släpper igenom till
 * resten av appen.
 */
export async function uppdateraProfilNamn(
  db: SQLiteDatabase,
  profilId: Uuid,
  namn: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.runAsync("UPDATE Profil SET namn = ?, updatedAt = ? WHERE id = ?", [
    namn,
    now,
    profilId,
  ]);
}
