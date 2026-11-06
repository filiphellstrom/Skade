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
  /** Migration 0005. Filnamn i appens filmapp (data:-URL på webben), se src/utils/filer.ts. */
  bild: string | null;
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
  /** Migration 0005. Filnamn i appens filmapp (data:-URL på webben), se src/utils/filer.ts. */
  bild: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/**
 * Migration 0003: en jaktmark är nu ett eget objekt, inte fri text på
 * Jaktdag. `wehuntId` är en nullbar plats för ett framtida Wehunt-objekt-
 * id - ingen integration byggd än, bara kolumnen reserverad för den.
 */
export interface Jaktmark {
  id: Uuid;
  profilId: Uuid;
  namn: string;
  wehuntId: string | null;
  /** Migration 0007. Ungefärlig position (2 decimaler), NULL = okänd. */
  lat: number | null;
  lon: number | null;
  /** Migration 0009. Gränsen som JSON [[lat, lon], ...] från GPX, NULL = ingen. */
  grans: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Migration 0009. En markering på en jaktmark (pass, torn, saltsten …), från GPX. */
export interface Kartpunkt {
  id: Uuid;
  jaktmarkId: Uuid;
  namn: string;
  /** WeHunts kategori oförändrad, t.ex. "stand", "tower". Se src/vind/gpx.ts. */
  typ: string;
  lat: number;
  lon: number;
  kalla: string;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Migration 0009. Ett sparat vindprognossteg (offline-cache och historik). */
export interface VindPrognosRad {
  id: Uuid;
  kalla: string;
  lat: number;
  lon: number;
  rutLat: number | null;
  rutLon: number | null;
  referensTid: UnixTimestamp | null;
  publiceradTid: UnixTimestamp | null;
  hamtadAt: UnixTimestamp;
  /** Prognosens giltighetstid. */
  tid: UnixTimestamp;
  /** Varifrån vinden kommer, grader. */
  vindRiktning: number | null;
  medelvind: number | null;
  byvind: number | null;
  jaktdagId: Uuid | null;
  jaktmarkId: Uuid | null;
  createdAt: UnixTimestamp;
}

/** Jaktmark med summering - Jaktmarker-fliken och väljaren i Ny jaktdag. */
export interface JaktmarkMedSummering extends Jaktmark {
  antalJaktdagar: number;
  senastDatum: UnixTimestamp | null;
  totalDrevtid: number;
}

export interface Jaktdag {
  id: Uuid;
  profilId: Uuid;
  datum: UnixTimestamp;
  jaktmarkId: Uuid;
  /**
   * Migration 0003: markens namn, hämtat via JOIN mot Jaktmark - inte
   * längre en egen kolumn på Jaktdag (se queries/jaktdag.ts). Fältet
   * heter fortfarande `jaktmark` och är fortfarande en vanlig sträng, så
   * ingen av de skärmar som bara VISAR markens namn (ScreenHeader,
   * timer.tsx, valj-hund.tsx, historik-skärmarna m.fl.) behövde ändras -
   * bara de frågor som skapar/hämtar en Jaktdag.
   */
  jaktmark: string;
  aktivHundId: Uuid | null;
  status: JaktdagStatus;
  avslutadAt: UnixTimestamp | null;
  /** Migration 0007. Manuellt valt före, NULL = inte angivet. */
  fore: Fore | null;
  /** Migration 0008. Jaktdagboken - fritext, NULL = ingen anteckning. */
  anteckning: string | null;
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

/**
 * Sprint 3 (historik): en avslutad jaktdag med antal drev och total
 * drevtid för just den dagen - se hamtaAvslutadeJaktdagarForProfil() i
 * queries/statistik.ts. Loggens listvy (app/historik/index.tsx) behöver
 * inte fler jaktdag-fält än de som redan finns på Jaktdag.
 */
export interface JaktdagMedSummering extends Jaktdag {
  antalDrev: number;
  totalDrevtid: number;
}

/** Ett drev inklusive hundens namn - för jaktdag-detaljvyn (app/historik/[jaktdagId].tsx). */
export interface DrevMedHundnamn extends Drev {
  hundNamn: string;
}

/** Ett namngivet antal, t.ex. en viltart eller ett utfall och hur många drev det gäller. */
export interface Fordelningspost {
  namn: string;
  antal: number;
}

/**
 * Sammanställd statistik för en hund - se hamtaStatistikPerHund() i
 * queries/statistik.ts. viltartFordelning/utfallFordelning är sorterade
 * fallande på antal; "Okänt" används som namn för drev utan
 * species/outcome satt.
 */
export interface HundStatistik {
  hundId: Uuid;
  namn: string;
  antalDrev: number;
  totalDrevtid: number;
  viltartFordelning: Fordelningspost[];
  utfallFordelning: Fordelningspost[];
  /** 2026-11-04: drevhändelser, väder/före och fällt vilt. */
  utokad: UtokadHundStatistik;
}

/** Snittdrevtid för en grupp drev (före eller temperaturintervall). */
export interface Snittpost {
  namn: string;
  antal: number;
  /** Snittdrevtid i sekunder. */
  snitt: number;
}

export interface UtokadHundStatistik {
  /** Total drevtid minus tappt, sekunder. */
  effektivDrevtid: number;
  /** Snitt söktid (släpp till upptag) för drev med släpp, sekunder. */
  snittSoktid: number | null;
  antalMedSoktid: number;
  antalTappt: number;
  /** Andel tappt som följdes av ett återupptag (0-1), null utan tappt. */
  atertagsgrad: number | null;
  perFore: Snittpost[];
  perTemperatur: Snittpost[];
  /** Antal fällda djur (summa av FalltVilt.antal) kopplade till hundens drev. */
  antalFallt: number;
  /** Antal drev som har minst ett fällt vilt kopplat. */
  drevMedFallt: number;
}

/** Migration 0005: dokument på profilen. */
export type DokumentTyp = "jagarexamen" | "vapenlicens" | "forsakring" | "ovrigt";
export type DokumentFiltyp = "bild" | "pdf";

export interface Dokument {
  id: Uuid;
  profilId: Uuid;
  typ: DokumentTyp;
  namn: string;
  /** Filnamn i appens filmapp (data:-URL på webben), NULL = ingen fil än. */
  fil: string | null;
  filtyp: DokumentFiltyp | null;
  /** Lokal midnatt sista giltiga dag. NULL = inget slutdatum. */
  giltigTill: UnixTimestamp | null;
  /** 7, 30 eller 60. */
  paminnelseDagar: number;
  notisId: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Migration 0006: händelser runt och inuti ett drev. */
export type HandelseTyp = "slapp" | "tappt" | "atertag" | "kopplad";

export interface DrevHandelse {
  id: Uuid;
  jaktdagId: Uuid;
  hundId: Uuid;
  /** Satt för tappt/atertag, NULL för slapp/kopplad. */
  drevId: Uuid | null;
  typ: HandelseTyp;
  tidpunkt: UnixTimestamp;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Migration 0007: före, valt manuellt per jaktdag. */
export type Fore = "barmark" | "frost" | "blott" | "sparsno" | "djupsno" | "skare";

export type VaderKalla = "smhi" | "manuell";

/** Migration 0007: väder vid ett drevs start (SMHI-prognos för närmaste timme). */
export interface Vader {
  id: Uuid;
  jaktdagId: Uuid;
  drevId: Uuid | null;
  tidpunkt: UnixTimestamp;
  /** °C */
  temperatur: number | null;
  /** m/s */
  vindHastighet: number | null;
  /** m/s */
  vindByar: number | null;
  /** Grader, 0 = nord (varifrån vinden blåser). */
  vindRiktning: number | null;
  /** mm/h */
  nederbord: number | null;
  kalla: VaderKalla;
  lat: number | null;
  lon: number | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

/** Migration 0008. */
export type Kon = "hane" | "hona";
export type Alder = "ungdjur" | "vuxen";

export interface FalltVilt {
  id: Uuid;
  jaktdagId: Uuid;
  drevId: Uuid | null;
  hundId: Uuid | null;
  art: string;
  antal: number;
  kon: Kon | null;
  alder: Alder | null;
  skytt: string | null;
  tidpunkt: UnixTimestamp;
  /** kg, slaktvikt */
  vikt: number | null;
  kommentar: string | null;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}
