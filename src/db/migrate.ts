import type { SQLiteDatabase } from "expo-sqlite";
import { sql as migration0001 } from "./migrations/0001_init";
import { sql as migration0002 } from "./migrations/0002_hund_arkiverad";

/**
 * Migrationsfiler i ordning. Varje post motsvarar en fil i ./migrations
 * och det PRAGMA user_version databasen ska ha EFTER att filen körts.
 *
 * Manuellt underhållen lista (vi kör rå SQL, inte en ORM) - lägg till en ny
 * post här varje gång en ny migrationsfil läggs till i migrations/.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  { version: 1, sql: migration0001 },
  { version: 2, sql: migration0002 },
];

/**
 * Kör alla migrationer med version högre än databasens nuvarande
 * PRAGMA user_version, i stigande ordning. Idempotent - säkert att
 * anropa vid varje appstart.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = result?.user_version ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await db.execAsync(migration.sql);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
