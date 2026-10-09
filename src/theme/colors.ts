import { useFarger } from "./TemaContext";

/**
 * Enkel färgpalett byggd för UX-principerna i projektinstruktionen
 * (avsnitt 13): hög kontrast så det går att läsa i dåligt ljus/mörker,
 * tydlig skillnad mellan tillstånd (vald/ovald, igång/stoppad) så det går
 * att använda snabbt utan att läsa finstilt text. Ingen extern
 * design-lib - bara ett objekt som skickas in i StyleSheet-anrop.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSelected: string;
  border: string;
  borderSelected: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  danger: string;
  dangerPressed: string;
  disabled: string;
  disabledText: string;
  bannerErrorBg: string;
  bannerErrorText: string;
  bannerInfoBg: string;
  bannerInfoText: string;
}

/**
 * ÖVERGÅNG (sprint 6): de gamla färgnamnen mappas nu till Design
 * Systemets tokens via temat i TemaContext.tsx, så att skärmar som inte
 * hunnit skrivas om ändå följer Ljust/Mörkt/System. Ny kod använder
 * useTema()/useFarger() och tokens-namnen direkt. Tas bort när alla
 * skärmar är omskrivna.
 */
export function useThemeColors(): ThemeColors {
  const f = useFarger();
  return {
    background: f.surface100,
    surface: f.surface200,
    surfaceSelected: f.brandSoft,
    border: f.borderStrong,
    borderSelected: f.brand,
    text: f.ink,
    textMuted: f.inkMuted,
    textOnPrimary: f.onBrand,
    primary: f.brand,
    primaryPressed: f.brand,
    danger: f.signal,
    dangerPressed: f.signal,
    disabled: f.surface300,
    disabledText: f.inkMuted,
    bannerErrorBg: f.surface200,
    bannerErrorText: f.signal,
    bannerInfoBg: f.brandSoft,
    bannerInfoText: f.ink,
  };
}
