import { KART_FARGER } from "@/theme/tokens";

/** Färg per kategori av kartpunkt. Delas av appens karta och webbkartan. */
export function punktFarg(typ: string): string {
  switch (typ) {
    case "stand":
      return KART_FARGER.pass;
    case "tower":
      return KART_FARGER.torn;
    case "parking":
      return KART_FARGER.parkering;
    case "salt_stone":
    case "feeding_grounds":
    case "bait":
      return KART_FARGER.foder;
    default:
      return KART_FARGER.ovrigt;
  }
}
