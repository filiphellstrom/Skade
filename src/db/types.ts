/**
 * Handskrivna typer som ska matcha src/db/migrations/*.ts exakt.
 *
 * VIKTIGT (medvetet val, se ändringslogg 2026-08-23): vi använder rå SQL
 * istället för en ORM. Det betyder att dessa typer INTE genereras automatiskt
 * från schemat. Varje gång schemat ändras (ny migration) måste denna fil
 * uppdateras för hand också - annars riskerar TypeScript-typerna att glida
 * isär från den faktiska databasen utan att kompilatorn varnar.
 *
 * SQLite lagrar booleans som INTEGER (0/1) och saknar en riktig boolean-
 * typ. `Hund.arkiverad` (migration 0002) är det första sådana fältet -
 * typat som `0 | 1` nedan istället för `boolean` för att ärligt spegla vad
 * expo-sqlite faktiskt returnerar från en rå SELECT (ingen automatisk
 * konvertering sker). Truthiness (`if (hund.arkiverad)`) fungerar som
 * väntat även så.
 */

export type Uuid = string;

/** Unix-tid i sekunder. */
export type UnixTimestamp = number;

export type JaktdagStatus = "pagar" | "avslutad";

export interface Profil {
  id: Uuid;
  namn: string;
  mailadress: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface Hund {
  id: Uuid;
  profilId: Uuid;
  namn: string;
  ras: string | null;
  fodelsedatum: UnixTimestamp | null;
  kommentar: string | null;
  /** Migration 0002. 0 = aktiv, 1 = arkiverad (dold från vanliga listor, historik orörd). */
  arkiverad: 0 | 1;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface Jaktdag {
  id: Uuid;
  profilId: Uuid;
  datum: UnixTimestamp;
  jaktmark: string;
  aktivHundId: Uuid | null;
  status: JaktdagStatus;
  avslutadAt: UnixTimestamp | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface JaktdagHund {
  jaktdagId: Uuid;
  hundId: Uuid;
}

export interface Drev {
  id: Uuid;
  jaktdagId: Uuid;
  hundId: Uuid;
  startTimestamp: UnixTimestamp;
  endTimestamp: UnixTimestamp | null;
  duration: number | null;
  species: string | null;
  outcome: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Ett pågående drev - endTimestamp/duration garanterat null. Praktisk
 * hjälptyp för timer-logiken i Sprint 1. */
export interface PagaendeDrev extends Drev {
  endTimestamp: null;
  duration: null;
}

/** Radform som huvudskärmens hundlista-query (se queries/hund.ts) returnerar. */
export interface HundMedSenasteJaktdag {
  hundId: Uuid;
  namn: string;
  senasteJaktDatum: UnixTimestamp | null;
  totalDrevtid: number;
}
