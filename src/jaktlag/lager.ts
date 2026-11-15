import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { inloggadeAnrop } from "@/konto/klient";
import { API_URL } from "@/konto/konfig";
import { lasSakert, sparaSakert } from "@/utils/lagring";
import { randomUUID as nyttUuid } from "@/utils/uuid";
import type {
  Eftersok,
  EftersokResultat,
  Lag,
  LagData,
  LagRad,
  Medlem,
  Meddelande,
  Plan,
  PlanInnehall,
  PlanStatus,
  Roll,
} from "./typer";

/**
 * Jaktlagens data i appen: hämtas från servern, hålls i minnet och sparas
 * i telefonen så att laget, planen, eftersöken och chatten går att läsa
 * utan täckning.
 *
 * - synka(lagId) hämtar allt som ändrats sedan sist (GET …/nytt?sedan=).
 *   Skärmarna anropar den med några sekunders mellanrum medan de visas.
 * - Eftersök och meddelanden som skapas utan täckning läggs i en utkorg
 *   och skickas vid nästa synk. De visas direkt, märkta "väntar".
 * - Allt annat (skapa lag, spara plan, ta ett eftersök) kräver täckning
 *   och ger ett fel man kan visa.
 */

export class ApiFel extends Error {
  constructor(
    /** 0 = servern gick inte att nå. */
    readonly status: number,
    text: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(text);
  }
  get utanNat(): boolean {
    return this.status === 0;
  }
}

export async function anropa<T>(metod: string, vag: string, data?: unknown): Promise<T> {
  const { headers, credentials } = await inloggadeAnrop();
  const avbryt = new AbortController();
  const timer = setTimeout(() => avbryt.abort(), 15000);
  let svar: Response;
  try {
    svar = await fetch(`${API_URL}/api${vag}`, {
      method: metod,
      headers: { ...headers, ...(data === undefined ? {} : { "Content-Type": "application/json" }) },
      credentials,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: avbryt.signal,
    });
  } catch {
    throw new ApiFel(0, "Kunde inte nå servern. Kontrollera täckningen och försök igen.");
  } finally {
    clearTimeout(timer);
  }
  let json: Record<string, unknown> | null = null;
  try {
    json = (await svar.json()) as Record<string, unknown>;
  } catch {
    // Tomt eller trasigt svar – hanteras nedan.
  }
  if (!svar.ok) {
    const text =
      svar.status === 401
        ? "Du är inte inloggad. Logga in under Profil → Konto."
        : typeof json?.fel === "string"
          ? json.fel
          : "Något gick fel på servern. Försök igen.";
    throw new ApiFel(svar.status, text, json ?? undefined);
  }
  return json as T;
}

/** Felets text, för en felrad på skärmen. */
export function felText(fel: unknown): string {
  return fel instanceof ApiFel ? fel.message : "Något gick fel. Försök igen.";
}

// ── Minne och lagring ────────────────────────────────────────────────

type Utkorgspost =
  | { typ: "eftersok"; lagId: string; data: { id: string; lat: number; lon: number; viltart: string; text: string; skapad: number } }
  | { typ: "meddelande"; lagId: string; data: { id: string; text: string } };

interface Tillstand {
  /** null = inte hämtad än. */
  lista: LagRad[] | null;
  lag: Record<string, LagData>;
  utkorg: Utkorgspost[];
  aktivPlan: { lagId: string; planId: string } | null;
  /** Räknas upp vid varje ändring. */
  version: number;
  laddadFranMinne: boolean;
}

const NYCKEL = { lista: "jaktlag:lista", utkorg: "jaktlag:utkorg", aktivPlan: "jaktlag:aktivPlan" };
const lagNyckel = (id: string) => `jaktlag:lag:${id}`;

let tillstand: Tillstand = {
  lista: null,
  lag: {},
  utkorg: [],
  aktivPlan: null,
  version: 0,
  laddadFranMinne: false,
};
const lyssnare = new Set<() => void>();

function satt(andring: Partial<Tillstand>) {
  tillstand = { ...tillstand, ...andring, version: tillstand.version + 1 };
  lyssnare.forEach((l) => l());
}

function prenumerera(l: () => void) {
  lyssnare.add(l);
  return () => {
    lyssnare.delete(l);
  };
}

function las<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function sattLag(id: string, data: LagData | null) {
  const lag = { ...tillstand.lag };
  if (data) {
    lag[id] = data;
    sparaSakert(lagNyckel(id), JSON.stringify(data));
  } else {
    delete lag[id];
    sparaSakert(lagNyckel(id), "");
  }
  satt({ lag });
}

function sattLista(lista: LagRad[]) {
  sparaSakert(NYCKEL.lista, JSON.stringify(lista));
  satt({ lista });
}

function sattUtkorg(utkorg: Utkorgspost[]) {
  sparaSakert(NYCKEL.utkorg, JSON.stringify(utkorg));
  satt({ utkorg });
}

let minnesLaddning: Promise<void> | null = null;

/** Läser in det som sparats i telefonen. Görs en gång. */
export function laddaFranMinne(): Promise<void> {
  minnesLaddning ??= (async () => {
    const lista = las<LagRad[]>(await lasSakert(NYCKEL.lista));
    const utkorg = las<Utkorgspost[]>(await lasSakert(NYCKEL.utkorg)) ?? [];
    const aktivPlan = las<Tillstand["aktivPlan"]>(await lasSakert(NYCKEL.aktivPlan));
    const lag: Record<string, LagData> = {};
    for (const rad of lista ?? []) {
      const data = las<LagData>(await lasSakert(lagNyckel(rad.id)));
      if (data) lag[rad.id] = data;
    }
    // Det som redan hunnit hämtas från servern går före det sparade.
    satt({
      lista: tillstand.lista ?? lista,
      lag: { ...lag, ...tillstand.lag },
      utkorg,
      aktivPlan,
      laddadFranMinne: true,
    });
  })();
  return minnesLaddning;
}

/** Glömmer allt om jaktlag i telefonen (vid utloggning och raderat konto). */
export function rensaJaktlag() {
  for (const id of Object.keys(tillstand.lag)) sparaSakert(lagNyckel(id), "");
  sparaSakert(NYCKEL.lista, "");
  sparaSakert(NYCKEL.utkorg, "");
  sparaSakert(NYCKEL.aktivPlan, "");
  satt({ lista: null, lag: {}, utkorg: [], aktivPlan: null });
}

// ── Hämta och synka ──────────────────────────────────────────────────

export async function hamtaLista(): Promise<LagRad[]> {
  await laddaFranMinne();
  const { jaktlag } = await anropa<{ jaktlag: LagRad[] }>("GET", "/jaktlag");
  sattLista(jaktlag);
  return jaktlag;
}

interface NyttSvar {
  nu: number;
  lag: Lag;
  medlemmar: Medlem[];
  planer: (Plan | { id: string; status: "borttagen"; uppdaterad: number })[];
  eftersok: Eftersok[];
  meddelanden: Meddelande[];
  blockerade: string[];
}

function slaIhop<T extends { id: string }>(gamla: T[], nya: T[]): T[] {
  if (nya.length === 0) return gamla;
  const karta = new Map(gamla.map((x) => [x.id, x]));
  for (const x of nya) karta.set(x.id, x);
  return [...karta.values()];
}

const pagaende = new Map<string, Promise<LagData | null>>();

/**
 * Hämtar allt nytt i ett jaktlag och skickar det som väntar i utkorgen.
 * Svarar med lagets data, eller null om laget inte längre finns (eller
 * man inte är med). Kastar ApiFel om servern inte gick att nå.
 */
export function synka(lagId: string): Promise<LagData | null> {
  const redan = pagaende.get(lagId);
  if (redan) return redan;
  const jobb = (async () => {
    await laddaFranMinne();
    await tomUtkorg(lagId);
    const fore = tillstand.lag[lagId];
    // Två sekunders överlapp, så att inget som skrevs i samma ögonblick missas.
    const sedan = fore?.synkad ? Math.max(0, fore.synkad - 2000) : 0;
    let svar: NyttSvar;
    try {
      svar = await anropa<NyttSvar>("GET", `/jaktlag/${lagId}/nytt?sedan=${sedan}`);
    } catch (fel) {
      if (fel instanceof ApiFel && fel.status === 404) {
        sattLag(lagId, null);
        if (tillstand.lista) sattLista(tillstand.lista.filter((l) => l.id !== lagId));
        return null;
      }
      throw fel;
    }
    const borta = new Set(svar.planer.filter((p) => p.status === "borttagen").map((p) => p.id));
    const planer = slaIhop(
      (fore?.planer ?? []).filter((p) => !borta.has(p.id)),
      svar.planer.filter((p): p is Plan => p.status !== "borttagen"),
    ).sort((a, b) => b.datum.localeCompare(a.datum));
    const blockerade = new Set(svar.blockerade);
    const vantande = new Set(tillstand.utkorg.map((u) => u.data.id));
    const data: LagData = {
      lag: svar.lag,
      medlemmar: svar.medlemmar,
      planer,
      eftersok: slaIhop(
        (fore?.eftersok ?? []).filter((e) => !e.vantar || vantande.has(e.id)),
        svar.eftersok,
      ).sort((a, b) => b.skapad - a.skapad),
      meddelanden: slaIhop(
        (fore?.meddelanden ?? []).filter((m) => !m.vantar || vantande.has(m.id)),
        svar.meddelanden,
      )
        .filter((m) => !blockerade.has(m.userId))
        .sort((a, b) => a.skapad - b.skapad)
        .slice(-400),
      blockerade: svar.blockerade,
      synkad: svar.nu,
      hamtad: Date.now(),
    };
    sattLag(lagId, data);
    return data;
  })().finally(() => pagaende.delete(lagId));
  pagaende.set(lagId, jobb);
  return jobb;
}

/** Skickar det som väntar. Det som servern avvisar kastas; det som inte kom fram ligger kvar. */
async function tomUtkorg(lagId: string) {
  for (const post of tillstand.utkorg.filter((u) => u.lagId === lagId)) {
    try {
      if (post.typ === "eftersok") await anropa("POST", `/jaktlag/${lagId}/eftersok`, post.data);
      else await anropa("POST", `/jaktlag/${lagId}/meddelande`, post.data);
    } catch (fel) {
      if (fel instanceof ApiFel && fel.utanNat) return;
    }
    sattUtkorg(tillstand.utkorg.filter((u) => u.data.id !== post.data.id));
  }
}

function andraLag(lagId: string, andring: (d: LagData) => LagData) {
  const d = tillstand.lag[lagId];
  if (d) sattLag(lagId, andring(d));
}

// ── Jaktlag ──────────────────────────────────────────────────────────

type LagSvar = { lag: Lag; medlemmar: Medlem[] };

function tomtLag(svar: LagSvar): LagData {
  return { ...svar, planer: [], eftersok: [], meddelanden: [], blockerade: [], synkad: 0, hamtad: Date.now() };
}

function taEmotLag(svar: LagSvar) {
  const fore = tillstand.lag[svar.lag.id];
  sattLag(svar.lag.id, fore ? { ...fore, ...svar } : tomtLag(svar));
}

export async function skapaLag(namn: string): Promise<string> {
  const svar = await anropa<LagSvar>("POST", "/jaktlag", { namn });
  taEmotLag(svar);
  await hamtaLista().catch(() => {});
  return svar.lag.id;
}

export async function gaMed(kod: string): Promise<string> {
  const svar = await anropa<LagSvar>("POST", "/jaktlag/ga-med", { kod });
  taEmotLag(svar);
  await hamtaLista().catch(() => {});
  return svar.lag.id;
}

export async function bytLagNamn(lagId: string, namn: string) {
  taEmotLag(await anropa<LagSvar>("PATCH", `/jaktlag/${lagId}`, { namn }));
  await hamtaLista().catch(() => {});
}

export async function bytKod(lagId: string) {
  taEmotLag(await anropa<LagSvar>("POST", `/jaktlag/${lagId}/kod`));
}

export async function andraRoll(lagId: string, userId: string, roll: Roll) {
  taEmotLag(await anropa<LagSvar>("PATCH", `/jaktlag/${lagId}/medlem/${userId}`, { roll }));
}

/** Tar bort en medlem, eller lämnar laget om det är en själv. */
export async function taBortMedlem(lagId: string, userId: string, jagSjalv: boolean) {
  await anropa("DELETE", `/jaktlag/${lagId}/medlem/${userId}`);
  if (jagSjalv) {
    sattLag(lagId, null);
    if (tillstand.lista) sattLista(tillstand.lista.filter((l) => l.id !== lagId));
    if (tillstand.aktivPlan?.lagId === lagId) valjAktivPlan(null);
  } else {
    andraLag(lagId, (d) => ({ ...d, medlemmar: d.medlemmar.filter((m) => m.userId !== userId) }));
  }
}

export async function raderaLag(lagId: string) {
  await anropa("DELETE", `/jaktlag/${lagId}`);
  sattLag(lagId, null);
  if (tillstand.lista) sattLista(tillstand.lista.filter((l) => l.id !== lagId));
  if (tillstand.aktivPlan?.lagId === lagId) valjAktivPlan(null);
}

// ── Planer ───────────────────────────────────────────────────────────

export async function skapaPlan(lagId: string, namn: string, datum: string, innehall: PlanInnehall): Promise<Plan> {
  const svar = await anropa<{ id: string; version: number; uppdaterad: number }>("POST", `/jaktlag/${lagId}/plan`, {
    id: nyttUuid(),
    namn,
    datum,
    innehall,
  });
  const plan: Plan = { id: svar.id, namn, datum, status: "utkast", version: svar.version, innehall, uppdaterad: svar.uppdaterad };
  andraLag(lagId, (d) => ({ ...d, planer: [plan, ...d.planer] }));
  return plan;
}

export async function sparaPlan(
  lagId: string,
  plan: Plan,
  andring: { namn: string; datum: string; status: PlanStatus; innehall: PlanInnehall },
): Promise<Plan> {
  const svar = await anropa<{ version: number; uppdaterad: number }>("PUT", `/plan/${plan.id}`, {
    ...andring,
    version: plan.version,
  });
  const ny: Plan = { ...plan, ...andring, version: svar.version, uppdaterad: svar.uppdaterad };
  andraLag(lagId, (d) => ({ ...d, planer: d.planer.map((p) => (p.id === plan.id ? ny : p)) }));
  return ny;
}

export async function raderaPlan(lagId: string, planId: string) {
  await anropa("DELETE", `/plan/${planId}`);
  andraLag(lagId, (d) => ({ ...d, planer: d.planer.filter((p) => p.id !== planId) }));
  if (tillstand.aktivPlan?.planId === planId) valjAktivPlan(null);
}

/** Planen som visas på Karta-fliken. */
export function valjAktivPlan(val: { lagId: string; planId: string } | null) {
  sparaSakert(NYCKEL.aktivPlan, val ? JSON.stringify(val) : "");
  satt({ aktivPlan: val });
}

// ── Eftersök ─────────────────────────────────────────────────────────

/**
 * Markerar ett eftersök. Visas direkt och skickas så fort det går –
 * utan täckning ligger det kvar i telefonen, märkt "väntar".
 */
export async function markeraEftersok(
  lagId: string,
  jag: { id: string; namn: string },
  val: { lat: number; lon: number; viltart: string; text: string },
): Promise<{ id: string; skickat: boolean }> {
  const nu = Date.now();
  const data = { id: nyttUuid(), ...val, skapad: nu };
  const lokalt: Eftersok = {
    ...data,
    jaktlagId: lagId,
    skapadAv: jag.id,
    skapadNamn: jag.namn,
    status: "oppet",
    tagetAv: null,
    tagetNamn: null,
    tagetHund: "",
    tagetTid: null,
    resultat: null,
    avslutText: "",
    avslutad: null,
    uppdaterad: nu,
    vantar: true,
  };
  andraLag(lagId, (d) => ({ ...d, eftersok: [lokalt, ...d.eftersok] }));
  sattUtkorg([...tillstand.utkorg, { typ: "eftersok", lagId, data }]);
  await tomUtkorg(lagId);
  const skickat = !tillstand.utkorg.some((u) => u.data.id === data.id);
  if (skickat) {
    andraLag(lagId, (d) => ({ ...d, eftersok: d.eftersok.map((e) => (e.id === data.id ? { ...e, vantar: false } : e)) }));
  }
  return { id: data.id, skickat };
}

function taEmotEftersok(e: Eftersok) {
  andraLag(e.jaktlagId, (d) => ({ ...d, eftersok: slaIhop(d.eftersok, [e]).sort((a, b) => b.skapad - a.skapad) }));
}

async function eftersokAnrop(id: string, vad: string, data?: unknown): Promise<Eftersok> {
  try {
    const { eftersok } = await anropa<{ eftersok: Eftersok }>("POST", `/eftersok/${id}/${vad}`, data ?? {});
    taEmotEftersok(eftersok);
    return eftersok;
  } catch (fel) {
    // Någon annan hann före: servern skickar med hur det ser ut nu.
    const nu = fel instanceof ApiFel ? (fel.data?.eftersok as Eftersok | undefined) : undefined;
    if (nu) taEmotEftersok(nu);
    throw fel;
  }
}

export const taEftersok = (id: string, hund: string) => eftersokAnrop(id, "ta", { hund });
export const lamnaEftersok = (id: string) => eftersokAnrop(id, "lamna");
export const avslutaEftersok = (id: string, resultat: EftersokResultat, text: string) =>
  eftersokAnrop(id, "avsluta", { resultat, text });

// ── Chatt ────────────────────────────────────────────────────────────

/** Skickar ett meddelande. Visas direkt; utan täckning skickas det senare. */
export async function skickaMeddelande(lagId: string, jag: { id: string; namn: string }, text: string) {
  const nu = Date.now();
  const data = { id: nyttUuid(), text };
  const lokalt: Meddelande = { ...data, userId: jag.id, namn: jag.namn, skapad: nu, borttaget: 0, uppdaterad: nu, vantar: true };
  andraLag(lagId, (d) => ({ ...d, meddelanden: [...d.meddelanden, lokalt] }));
  sattUtkorg([...tillstand.utkorg, { typ: "meddelande", lagId, data }]);
  await tomUtkorg(lagId);
  if (!tillstand.utkorg.some((u) => u.data.id === data.id)) {
    andraLag(lagId, (d) => ({
      ...d,
      meddelanden: d.meddelanden.map((m) => (m.id === data.id ? { ...m, vantar: false } : m)),
    }));
  }
}

export async function taBortMeddelande(lagId: string, id: string) {
  await anropa("DELETE", `/meddelande/${id}`);
  andraLag(lagId, (d) => ({
    ...d,
    meddelanden: d.meddelanden.map((m) => (m.id === id ? { ...m, borttaget: 1, text: "" } : m)),
  }));
}

export async function rapporteraMeddelande(id: string, orsak: string) {
  await anropa("POST", `/meddelande/${id}/rapportera`, { orsak });
}

export async function blockera(lagId: string, userId: string) {
  await anropa("POST", "/blockering", { userId });
  andraLag(lagId, (d) => ({
    ...d,
    blockerade: [...new Set([...d.blockerade, userId])],
    meddelanden: d.meddelanden.filter((m) => m.userId !== userId),
  }));
}

export async function avblockera(lagId: string, userId: string) {
  await anropa("DELETE", `/blockering/${userId}`);
  // Tvinga en full hämtning, så att de dolda meddelandena kommer tillbaka.
  andraLag(lagId, (d) => ({ ...d, blockerade: d.blockerade.filter((b) => b !== userId), synkad: 0 }));
  await synka(lagId).catch(() => {});
}

// ── Krokar för skärmarna ─────────────────────────────────────────────

function useTillstand(): Tillstand {
  return useSyncExternalStore(
    prenumerera,
    () => tillstand,
    () => tillstand,
  );
}

/** Mina jaktlag. null tills något finns att visa. */
export function useLagLista(): LagRad[] | null {
  return useTillstand().lista;
}

/** Ett jaktlags data ur minnet. undefined = inget sparat. */
export function useLagData(lagId: string | undefined): LagData | undefined {
  const t = useTillstand();
  return lagId ? t.lag[lagId] : undefined;
}

export function useAktivPlan(): { lagId: string; plan: Plan; data: LagData } | null {
  const t = useTillstand();
  if (!t.aktivPlan) return null;
  const data = t.lag[t.aktivPlan.lagId];
  const plan = data?.planer.find((p) => p.id === t.aktivPlan?.planId);
  return data && plan ? { lagId: t.aktivPlan.lagId, plan, data } : null;
}

/**
 * Håller ett jaktlag uppdaterat medan skärmen visas: synkar direkt, sedan
 * med jämna mellanrum, och när appen kommer tillbaka till förgrunden.
 * onBorta anropas om laget inte längre finns.
 */
export function useSynk(lagId: string | undefined, intervallMs: number, onBorta?: () => void) {
  useEffect(() => {
    laddaFranMinne();
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!lagId) return;
      let aktiv = true;
      const kor = () => {
        if (AppState.currentState !== "active") return;
        synka(lagId)
          .then((d) => {
            if (aktiv && d === null) onBorta?.();
          })
          .catch(() => {});
      };
      kor();
      const timer = setInterval(kor, intervallMs);
      const sub = AppState.addEventListener("change", (lage) => {
        if (lage === "active") kor();
      });
      return () => {
        aktiv = false;
        clearInterval(timer);
        sub.remove();
      };
      // onBorta är en ny funktion vid varje rendering och ska inte starta om synken.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lagId, intervallMs]),
  );
}

/** Alla eftersök som inte är avslutade, i alla mina jaktlag – för kartan. */
export function useAktivaEftersok(): Eftersok[] {
  const t = useTillstand();
  return Object.values(t.lag).flatMap((d) => d.eftersok.filter((e) => e.status !== "avslutat"));
}
