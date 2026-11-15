/**
 * Det som delas i ett jaktlag och ligger på servern (server/src/api.ts):
 * laget och medlemmarna, jaktplaner, eftersök och chatt. Tider är
 * millisekunder sedan 1970, som i resten av appen.
 */

export type Roll = "ansvarig" | "hundforare";

export interface LagRad {
  id: string;
  namn: string;
  minRoll: Roll;
  antalMedlemmar: number;
  uppdaterad: number;
}

export interface Lag {
  id: string;
  namn: string;
  skapad: number;
  minRoll: Roll;
  /** Inbjudningskoden. Bara ansvariga får den. */
  kod: string | null;
}

export interface Medlem {
  userId: string;
  namn: string;
  roll: Roll;
  gickMed: number;
}

export interface Punkt {
  lat: number;
  lon: number;
}

/** En punkt på en rutt. Första punkten är start och sista är mål. */
export interface Ruttpunkt extends Punkt {
  id: string;
  /** Extra viktig att gå igenom – får egen symbol och kan bockas av. */
  viktig?: boolean;
  text?: string;
}

/** En hundförares uppdrag i planen. */
export interface Uppdrag {
  id: string;
  /** Kopplad medlem i laget, om föraren har ett konto. */
  userId?: string | null;
  forare: string;
  hund: string;
  farg: string;
  slapp?: Punkt | null;
  /** "HH:MM" */
  slappTid?: string;
  anteckning?: string;
  rutt: Ruttpunkt[];
}

/** Jaktmarkens gräns och markeringar, kopierade in i planen så att alla ser dem. */
export interface PlanJaktmark {
  namn: string;
  grans: [number, number][];
  punkter: { namn: string; typ: string; lat: number; lon: number }[];
}

export interface PlanInnehall {
  samling?: (Punkt & { tid?: string; text?: string }) | null;
  anteckning?: string;
  jaktmark?: PlanJaktmark | null;
  uppdrag: Uppdrag[];
}

export type PlanStatus = "utkast" | "publicerad" | "stangd";

export interface Plan {
  id: string;
  namn: string;
  /** ÅÅÅÅ-MM-DD */
  datum: string;
  status: PlanStatus;
  version: number;
  innehall: PlanInnehall;
  uppdaterad: number;
}

export type EftersokStatus = "oppet" | "taget" | "avslutat";
export type EftersokResultat = "hittat" | "inte_hittat" | "avbrutet";

export interface Eftersok {
  id: string;
  jaktlagId: string;
  lat: number;
  lon: number;
  viltart: string;
  text: string;
  skapadAv: string | null;
  skapadNamn: string | null;
  skapad: number;
  status: EftersokStatus;
  tagetAv: string | null;
  tagetNamn: string | null;
  tagetHund: string;
  tagetTid: number | null;
  resultat: EftersokResultat | null;
  avslutText: string;
  avslutad: number | null;
  uppdaterad: number;
  /** Bara i telefonen: väntar på att skickas (ingen täckning). */
  vantar?: boolean;
}

export interface Meddelande {
  id: string;
  userId: string;
  namn: string;
  text: string;
  skapad: number;
  borttaget: number;
  uppdaterad: number;
  /** Bara i telefonen: väntar på att skickas. */
  vantar?: boolean;
}

/** Allt appen vet om ett jaktlag. Sparas i telefonen så att det går att läsa utan täckning. */
export interface LagData {
  lag: Lag;
  medlemmar: Medlem[];
  planer: Plan[];
  eftersok: Eftersok[];
  meddelanden: Meddelande[];
  blockerade: string[];
  /** Serverns klocka vid senaste hämtningen (skickas som ?sedan=). */
  synkad: number;
  /** Telefonens klocka vid senaste lyckade hämtningen. */
  hamtad: number;
}

/** Färger för uppdrag, i tur och ordning. Syns mot både karta och flygfoto. */
export const UPPDRAGSFARGER = ["#e4572e", "#2b6cb0", "#8a4fbf", "#c98a00", "#2f8f57", "#d6336c", "#0b8a8a", "#6b4f2a"];

export const RESULTAT_NAMN: Record<EftersokResultat, string> = {
  hittat: "Hittat",
  inte_hittat: "Inte hittat",
  avbrutet: "Avbrutet",
};

/** Ruttens längd i meter. */
export function ruttLangd(rutt: Punkt[]): number {
  let summa = 0;
  for (let i = 1; i < rutt.length; i++) summa += avstandMeter(rutt[i - 1], rutt[i]);
  return summa;
}

export function avstandMeter(a: Punkt, b: Punkt): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Kompassriktning från a till b, i grader (0 = norr). */
export function riktningGrader(a: Punkt, b: Punkt): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

const VADERSTRECK = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"];

/** 0–360° → "N", "NO", … */
export function vaderstreck(grader: number): string {
  return VADERSTRECK[Math.round(grader / 45) % 8];
}

/** 480 → "480 m", 1530 → "1,5 km" */
export function formateraAvstand(meter: number): string {
  if (meter < 1000) return `${Math.round(meter / 10) * 10} m`;
  return `${(meter / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Mitt uppdrag i en plan: kopplat till mitt konto, annars samma namn. */
export function mittUppdrag(plan: Plan, userId: string | null, namn: string | null): Uppdrag | null {
  const u = plan.innehall.uppdrag;
  return (
    (userId ? u.find((x) => x.userId === userId) : undefined) ??
    (namn ? u.find((x) => !x.userId && x.forare.trim().toLowerCase() === namn.trim().toLowerCase()) : undefined) ??
    null
  );
}
