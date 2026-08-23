import { useEffect, useState } from "react";
import type { UnixTimestamp } from "@/db/types";

/**
 * Räknar upp sekunder för visning under ett pågående drev.
 *
 * VIKTIGT: detta är bara en UI-ticker. Källan till sanning för hur länge
 * ett drev pågått är alltid `startTimestamp` som redan är sparat i
 * databasen (se startaDrev() i src/db/queries/drev.ts) - inte något som
 * räknas fram och hålls i JS-state. Om appen dödas/backgroundas och öppnas
 * igen mitt i ett drev, räknar denna hook helt enkelt om `nu - startTimestamp`
 * på nytt, vilket ger rätt värde utan någon återställningslogik. Se
 * timer.tsx som hämtar startTimestamp från hamtaPagaendeDrev() vid mount.
 *
 * `startTimestamp` är null när inget drev pågår - då returneras 0 och
 * ingen interval-timer startas.
 */
export function useElapsedTime(startTimestamp: UnixTimestamp | null): number {
  const berakna = () =>
    startTimestamp === null
      ? 0
      : Math.max(0, Math.floor(Date.now() / 1000) - startTimestamp);

  const [elapsed, setElapsed] = useState(berakna);

  useEffect(() => {
    setElapsed(berakna());

    if (startTimestamp === null) {
      return;
    }

    const interval = setInterval(() => {
      setElapsed(berakna());
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTimestamp]);

  return elapsed;
}

/** Formaterar sekunder som mm:ss, eller hh:mm:ss om drevet passerat en timme. */
export function formateraTid(totalSekunder: number): string {
  const timmar = Math.floor(totalSekunder / 3600);
  const minuter = Math.floor((totalSekunder % 3600) / 60);
  const sekunder = totalSekunder % 60;

  const mm = String(minuter).padStart(2, "0");
  const ss = String(sekunder).padStart(2, "0");

  if (timmar > 0) {
    return `${timmar}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}
