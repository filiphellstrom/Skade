import type { Spar } from "@/db/types";
import { KART_FARGER } from "@/theme/tokens";
import { glesa, packaUpp } from "@/spar/hundspar";

/** Ett spår att rita, i react-native-maps koordinatform. */
export interface SparLager {
  id: string;
  typ: Spar["typ"];
  drevId: string | null;
  farg: string;
  bredd: number;
  streckad: boolean;
  koordinater: { latitude: number; longitude: number }[];
}

/**
 * Bygger ritlager av jaktdagens spår. Hundspåren får en färg per drev (i
 * drevens ordning), förarens spår streckat, halsbandets spår utanför
 * dreven tunt och grått. Långa spår glesas ut till 1 500 punkter för
 * kartan (sträckorna är redan uträknade på alla punkter vid importen).
 */
export function byggSparLager(spar: Spar[], drevOrdning: string[]): SparLager[] {
  const lager: SparLager[] = [];
  for (const s of spar) {
    const koordinater = glesa(packaUpp(s.punkter)).map((p) => ({ latitude: p.lat, longitude: p.lon }));
    if (koordinater.length < 2) continue;
    if (s.typ === "hund") {
      const i = Math.max(0, drevOrdning.indexOf(s.drevId ?? ""));
      lager.push({
        id: s.id,
        typ: s.typ,
        drevId: s.drevId,
        farg: KART_FARGER.hundspar[i % KART_FARGER.hundspar.length],
        bredd: 4,
        streckad: false,
        koordinater,
      });
    } else if (s.typ === "forare") {
      lager.push({ id: s.id, typ: s.typ, drevId: null, farg: KART_FARGER.forare, bredd: 2.5, streckad: true, koordinater });
    } else {
      lager.push({ id: s.id, typ: s.typ, drevId: null, farg: KART_FARGER.halsband, bredd: 1.5, streckad: false, koordinater });
    }
  }
  // Halsband underst, sedan föraren, hundspåren överst.
  const ordning = { halsband: 0, forare: 1, hund: 2 } as const;
  return lager.sort((a, b) => ordning[a.typ] - ordning[b.typ]);
}

/** Färgen för ett drev i listan, samma som på kartan. */
export function drevFarg(drevId: string, drevOrdning: string[]): string {
  const i = Math.max(0, drevOrdning.indexOf(drevId));
  return KART_FARGER.hundspar[i % KART_FARGER.hundspar.length];
}
