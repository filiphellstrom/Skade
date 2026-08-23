import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrate";

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

  dbInstance = db;
  return dbInstance;
}
