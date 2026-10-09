import { Knapp } from "@/components/ui/Knapp";
import type { KnappVariant } from "@/components/ui/Knapp";

export type BigButtonVariant = "primary" | "danger" | "secondary";

interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: BigButtonVariant;
  disabled?: boolean;
  laddar?: boolean;
  /**
   * tap-small (36 px) i stället för tap-min - medveten broms för Arkivera
   * hund, Radera hund och Radera drev (beslutat 2026-08-29, bekräftat i
   * Design Systemet). Inte för bekräftelsestegets knappar.
   */
  liten?: boolean;
}

/**
 * Äldre API, behålls så att skärmarna inte behöver skrivas om på en gång.
 * Ritas nu av Design Systemets Knapp (src/components/ui/Knapp.tsx):
 * primary = primär, secondary = sekundär, danger = fara (bekräftad
 * radering), danger + liten = liten fara-knapp (kant, ingen fyllning).
 */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  laddar = false,
  liten = false,
}: BigButtonProps) {
  const v: KnappVariant =
    variant === "danger" ? (liten ? "faraLiten" : "fara") : variant === "secondary" ? "sekundar" : "primar";
  return <Knapp titel={label} onPress={onPress} variant={v} disabled={disabled} laddar={laddar} />;
}
