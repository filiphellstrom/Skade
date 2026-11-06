import { useEffect, useRef, useState } from "react";
import { getDatabase } from "@/db/client";
import { senasteSparadePrognos, sparaVindprognos } from "@/db/queries/vindprognos";
import type { Uuid } from "@/db/types";
import { avrundaPosition, smhiKalla } from "@/vind/prognos";
import type { VindKalla, VindPrognos } from "@/vind/prognos";

/**
 * Hämtar vindprognoser för ett antal punkter (avrundade till ~1 km).
 *
 * - Först från källan (SMHI). Varje lyckad hämtning sparas i databasen
 *   med tidsstämpel och koppling till pågående jaktdag/jaktmark.
 * - Misslyckas hämtningen (ingen täckning) används den senast sparade
 *   prognosen för punkten, markerad som sparad (`franMinne`).
 * - En punkt hämtas igen tidigast efter 30 minuter.
 *
 * Källan kan bytas genom att skicka in en annan VindKalla.
 */

export interface Punktprognos {
  prognos: VindPrognos | null;
  /** true = från databasen (hämtningen misslyckades). */
  franMinne: boolean;
  /** true = hämtning pågår. */
  laddar: boolean;
  fel: string | null;
}

export const punktNyckel = (lat: number, lon: number) =>
  `${avrundaPosition(lat).toFixed(2)},${avrundaPosition(lon).toFixed(2)}`;

const HAMTA_IGEN = 30 * 60 * 1000;

/** Gemensam minnescache för hela appen, så att flikbyten inte hämtar om. */
const cache = new Map<string, { data: Punktprognos; hamtad: number }>();

export function useVindprognoser(
  nycklar: string[],
  koppling: { jaktdagId: Uuid | null; jaktmarkId: Uuid | null },
  /** Öka för att tvinga en ny hämtning ("Hämta igen"). */
  forsok = 0,
  kalla: VindKalla = smhiKalla,
): Record<string, Punktprognos> {
  const [, setVersion] = useState(0);
  const pagar = useRef(new Set<string>());
  const kopplingRef = useRef(koppling);
  kopplingRef.current = koppling;
  const nyckelText = [...new Set(nycklar)].sort().join(";");
  const senasteForsok = useRef(forsok);

  useEffect(() => {
    let avbruten = false;
    const lista = nyckelText ? nyckelText.split(";") : [];
    const tvinga = senasteForsok.current !== forsok;
    senasteForsok.current = forsok;
    const attHamta = lista.filter((k) => {
      const c = cache.get(k);
      return !pagar.current.has(k) && (tvinga || !c || Date.now() - c.hamtad > HAMTA_IGEN);
    });
    if (attHamta.length === 0) return;

    (async () => {
      for (const k of attHamta) {
        pagar.current.add(k);
        const [lat, lon] = k.split(",").map(Number);
        const tidigare = cache.get(k)?.data.prognos ?? null;
        cache.set(k, {
          data: { prognos: tidigare, franMinne: false, laddar: true, fel: null },
          hamtad: cache.get(k)?.hamtad ?? 0,
        });
        if (!avbruten) setVersion((v) => v + 1);
        let data: Punktprognos;
        try {
          const prognos = await kalla.hamta(lat, lon);
          data = { prognos, franMinne: false, laddar: false, fel: null };
          try {
            const db = await getDatabase();
            await sparaVindprognos(db, prognos, kopplingRef.current);
          } catch (e) {
            console.warn("[vind] kunde inte spara prognosen", e);
          }
        } catch {
          let sparad: VindPrognos | null = null;
          try {
            const db = await getDatabase();
            sparad = await senasteSparadePrognos(db, kalla.id, lat, lon, {
              kallaNamn: kalla.namn,
              attribution: tidigare?.attribution ?? `Källa: ${kalla.namn}`,
            });
          } catch {
            // ingen sparad prognos
          }
          data = {
            prognos: sparad ?? tidigare,
            franMinne: !!(sparad ?? tidigare),
            laddar: false,
            fel: `Kunde inte hämta prognos från ${kalla.namn}.`,
          };
        }
        // Misslyckad hämtning: försök igen om 2 minuter i stället för 30.
        const hamtad = data.fel ? Date.now() - HAMTA_IGEN + 2 * 60 * 1000 : Date.now();
        cache.set(k, { data, hamtad });
        pagar.current.delete(k);
        if (!avbruten) setVersion((v) => v + 1);
      }
    })();

    return () => {
      avbruten = true;
    };
  }, [nyckelText, kalla, forsok]);

  const ut: Record<string, Punktprognos> = {};
  for (const k of nycklar) {
    const c = cache.get(k);
    if (c) ut[k] = c.data;
  }
  return ut;
}
