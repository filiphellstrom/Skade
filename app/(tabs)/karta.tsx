import { KartaVy } from "@/components/karta/KartaVy";

/**
 * Fliken Karta (steg 1, 2026-11-04): kartan med den egna positionen.
 * Själva vyn ligger i src/components/karta - KartaVy.tsx i appen
 * (Apple Maps via react-native-maps) och KartaVy.web.tsx på webben, där
 * Apple Maps inte finns. Metro väljer .web.tsx automatiskt på webben.
 */
export default function KartaFlik() {
  return <KartaVy />;
}
