// Skriver ut SQL för de tabeller Better Auth behöver och som saknas i en tom
// databas med migrationerna i ../migrations körda. Används när Better Auth
// uppgraderas eller ett tillägg läggs till:
//   npm run schema            → SQL på stdout (tomt = inget saknas)
// Klistra in resultatet som en ny fil i migrations/.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { getMigrations } from "better-auth/db/migration";
import { byggAuthAlternativ } from "../src/auth-alternativ.ts";
import type { Miljo } from "../src/miljo.ts";

const mapp = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const db = new Database(":memory:");
for (const fil of readdirSync(mapp).filter((f) => f.endsWith(".sql")).sort()) {
  db.exec(readFileSync(join(mapp, fil), "utf8"));
}

const miljo = {
  BETTER_AUTH_URL: "https://api.skade.hellstrom.fyi",
  BETTER_AUTH_SECRET: "bara-for-schemat-bara-for-schemat-00",
  WEBB_URL: "https://skade.hellstrom.fyi",
  APPLE_BUNDLE_ID: "com.skade.app",
  APPLE_TEAM_ID: "X",
} as Miljo;

const { compileMigrations } = await getMigrations(byggAuthAlternativ(miljo, db));
process.stdout.write(await compileMigrations());
