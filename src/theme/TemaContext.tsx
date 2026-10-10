import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import { lasSakert, sparaSakert } from "@/utils/lagring";
import { FARGER, KORT_SKUGGA } from "./tokens";
import type { Farger, Schema } from "./tokens";

/**
 * Appens tema (Ljust, Mörkt, System) och timerns eget tema.
 *
 * Två SEPARATA inställningar, sparade i expo-sqlite:s nyckel-värde-lagring
 * i appen och i localStorage på webben (ingen schemaändring i appens
 * databas, fungerar offline):
 * - `skade.tema`: "ljust" | "morkt" | "system" (standard "system").
 * - `skade.timerTema`: "ljust" | "morkt", eller saknas. Saknas = timern
 *   följer appens tema. Sätts första gången man trycker på timerns
 *   tema-knapp och gäller sedan tills man byter (ingen väg tillbaka till
 *   "följ appen" - medvetet enkelt, se design-lyft-beslut.md).
 */
export type TemaVal = "ljust" | "morkt" | "system";
export type TimerTemaVal = "ljust" | "morkt";

const NYCKEL_TEMA = "skade.tema";
const NYCKEL_TIMER_TEMA = "skade.timerTema";

interface TemaContextValue {
  /** Appens tema-val i Inställningar. */
  temaVal: TemaVal;
  setTemaVal: (val: TemaVal) => void;
  /** Det schema appen faktiskt visar just nu (System upplöst). */
  schema: Schema;
  farger: Farger;
  kortSkugga: string | undefined;
  /** Timerns eget val, null = följer appen. */
  timerTemaVal: TimerTemaVal | null;
  setTimerTemaVal: (val: TimerTemaVal) => void;
  /** Det schema timern visar. */
  timerSchema: Schema;
}

const TemaContext = createContext<TemaContextValue | null>(null);

function arTemaVal(v: string | null): v is TemaVal {
  return v === "ljust" || v === "morkt" || v === "system";
}
function arTimerTemaVal(v: string | null): v is TimerTemaVal {
  return v === "ljust" || v === "morkt";
}

/** Läser sparade val innan appen visas, så att första bilden har rätt tema. */
export async function laddaTemaInstallningar(): Promise<{
  temaVal: TemaVal;
  timerTemaVal: TimerTemaVal | null;
}> {
  const [t, tt] = await Promise.all([lasSakert(NYCKEL_TEMA), lasSakert(NYCKEL_TIMER_TEMA)]);
  return {
    temaVal: arTemaVal(t) ? t : "system",
    timerTemaVal: arTimerTemaVal(tt) ? tt : null,
  };
}

export function TemaProvider({
  initial,
  children,
}: {
  initial: { temaVal: TemaVal; timerTemaVal: TimerTemaVal | null };
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [temaVal, setTemaState] = useState<TemaVal>(initial.temaVal);
  const [timerTemaVal, setTimerState] = useState<TimerTemaVal | null>(initial.timerTemaVal);

  const setTemaVal = useCallback((val: TemaVal) => {
    setTemaState(val);
    sparaSakert(NYCKEL_TEMA, val);
  }, []);

  const setTimerTemaVal = useCallback((val: TimerTemaVal) => {
    setTimerState(val);
    sparaSakert(NYCKEL_TIMER_TEMA, val);
  }, []);

  const schema: Schema =
    temaVal === "system"
      ? system === "dark"
        ? "dark"
        : "light"
      : temaVal === "morkt"
        ? "dark"
        : "light";

  const timerSchema: Schema =
    timerTemaVal === null ? schema : timerTemaVal === "morkt" ? "dark" : "light";

  const value = useMemo<TemaContextValue>(
    () => ({
      temaVal,
      setTemaVal,
      schema,
      farger: FARGER[schema],
      kortSkugga: KORT_SKUGGA[schema],
      timerTemaVal,
      setTimerTemaVal,
      timerSchema,
    }),
    [temaVal, setTemaVal, schema, timerTemaVal, setTimerTemaVal, timerSchema],
  );

  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema(): TemaContextValue {
  const ctx = useContext(TemaContext);
  if (!ctx) {
    throw new Error("useTema() måste anropas inom <TemaProvider> (app/_layout.tsx).");
  }
  return ctx;
}

/**
 * Före TemaProvider monterats (laddningsskärmen i app/_layout.tsx):
 * systemets schema, utan sparade val.
 */
export function useSystemFarger(): Farger {
  const system = useColorScheme();
  return FARGER[system === "dark" ? "dark" : "light"];
}

/** Hjälp för komponenter som bara vill ha färgerna. */
export function useFarger(): Farger {
  return useTema().farger;
}

/** Används av timern: färger för timerns eget schema. */
export function useTimerFarger(): { farger: Farger; schema: Schema } {
  const { timerSchema } = useTema();
  return { farger: FARGER[timerSchema], schema: timerSchema };
}

/**
 * Lägger timerns eget tema över allt innehåll inuti (Txt, Knapp, Tillbaka
 * osv. läser useTema() och får då timerns färger). Används bara runt
 * timern - resten av appen påverkas inte.
 */
export function TimerTemaOmrade({ children }: { children: ReactNode }) {
  const yttre = useTema();
  const value = useMemo<TemaContextValue>(
    () => ({
      ...yttre,
      schema: yttre.timerSchema,
      farger: FARGER[yttre.timerSchema],
      kortSkugga: KORT_SKUGGA[yttre.timerSchema],
    }),
    [yttre],
  );
  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}
