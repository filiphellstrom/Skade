# Skade

Jaktapp för att dokumentera, följa och analysera jakthundars arbete (drev)
över tid. Se projektinstruktionen (Claude Project "Skade") för full kontext.

## Kom igång

```bash
npm install
npx expo start
```

> **OBS om versioner:** beroendena i `package.json` är satta till versioner
> som var aktuella vid scaffolding-tillfället. Kör `npx expo install --fix`
> efter första `npm install` för att låta Expo justera till exakt kompatibla
> versioner för din installerade Expo SDK - AI-genererade versionsnummer kan
> vara inaktuella.

## Teknikval

- **Expo + TypeScript** (strict mode), **Expo Router** för filbaserad navigation
- **expo-sqlite** för lokal databas, **rå SQL** (inte en ORM/Drizzle) för
  migrations och typer - ett medvetet val för enkelhet och transparens
- **expo-crypto** för UUID-baserade primärnycklar (stödjer framtida
  offline-skapade poster som synkas till Supabase utan ID-kollisioner)
- **@supabase/supabase-js** installerat men inte konfigurerat än (kommer i
  en senare synk-sprint)

## Databas

Schemat definieras i `src/db/migrations/0001_init.ts` (källan till sanningen,
importeras av appen). En läsbar SQL-kopia för manuell körning/felsökning
finns i `0001_init.sql.reference` i samma mapp - håll dem i synk för hand.

`src/db/migrate.ts` kör okörda migrationer vid varje appstart, styrt av
`PRAGMA user_version`. `src/db/client.ts` öppnar anslutningen och sätter
`PRAGMA foreign_keys = ON` (avstängt som standard i SQLite).

Eftersom vi kör rå SQL istället för en ORM: **när schemat ändras, uppdatera
tre ställen för hand** - migrationsfilen, `src/db/types.ts`, och eventuella
queries i `src/db/queries/` som berörs.

## Mappstruktur

```
app/                # Expo Router - en fil = en skärm
src/db/              # Schema, migrations, typer, queries
src/features/         # Skärmspecifik logik per flöde
src/components/       # Delade UI-komponenter
src/utils/            # Hjälpfunktioner (t.ex. UUID-generering)
```

## Status

Scaffolding klar (grundstruktur, schema, migrations, typer, tomma
platshållarskärmar). Sprint 1-funktionaliteten (Ny jaktdag → Välj hund →
Starta timer) byggs i nästa steg.
