/**
 * Migration 0002 – lägger till möjligheten att arkivera en hund.
 *
 * Beslutad: 2026-08-23, i chatten "Skade – Sprint 1" (som vid det här laget
 * täcker flera sprintar). INTE en ändring av 0001_init.ts - den migrationen
 * är redan körd på Filips enhet (och ska förbli orörd som historisk
 * sanning om vad version 1 av schemat var), så en ny fristående fil är
 * rätt sätt att lägga till ett fält enligt mönstret i migrate.ts.
 *
 * `arkiverad` är en "soft delete"-flagga: en arkiverad hund plockas bort
 * ur de vanliga listorna (huvudskärmens hundlista, hundvalet i "Välj
 * hund") utan att hundens historik (Drev/JaktdagHund-rader) rörs. Skiljer
 * sig från raderaHund() i src/db/queries/hund.ts, som tar bort hunden och
 * all dess historik permanent.
 *
 * SQLite lagrar booleans som INTEGER (0/1) - se OBS i src/db/types.ts.
 * ALTER TABLE ... ADD COLUMN med DEFAULT backfyller alla befintliga rader
 * med 0 automatiskt, så det här är säkert att köra på en databas som redan
 * har data.
 */
export const sql = `
ALTER TABLE Hund ADD COLUMN arkiverad INTEGER NOT NULL DEFAULT 0;
`;
