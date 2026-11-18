import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrate";
import { rattaDrevtiderMedAtergang } from "./queries/drev";

const DATABASE_NAME = "skade.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Öppnar (eller återanvänder) databasanslutningen. Aktiverar foreign keys
 * och kör okörda migrationer varje gång - se OBS i 0001_init.ts om varför
 * PRAGMA foreign_keys måste sättas explicit i SQLite.
 *
 * Anropa denna en gång vid appstart (t.ex. i app/_layout.tsx) innan någon
 * skärm försöker läsa/skriva till databasen.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  // Drev stoppade från låsskärmen medan appen var stängd (2026-11-18).
  try {
    await rattaDrevtiderMedAtergang(db);
  } catch {
    // Får aldrig hindra appen från att starta.
  }

  dbInstance = db;
  return dbInstance;
}
