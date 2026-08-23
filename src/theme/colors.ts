import { useColorScheme } from "react-native";

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

const light: ThemeColors = {
  background: "#F5F3EF",
  surface: "#FFFFFF",
  surfaceSelected: "#E7F3E9",
  border: "#D8D3C8",
  borderSelected: "#2F6B3A",
  text: "#1A1A16",
  textMuted: "#5C594F",
  textOnPrimary: "#FFFFFF",
  primary: "#2F6B3A",
  primaryPressed: "#255730",
  danger: "#B3261E",
  dangerPressed: "#8F1E18",
  disabled: "#D8D3C8",
  disabledText: "#8A8676",
  bannerErrorBg: "#FBE9E7",
  bannerErrorText: "#8F1E18",
  bannerInfoBg: "#EAF0EC",
  bannerInfoText: "#33402F",
};

const dark: ThemeColors = {
  background: "#121210",
  surface: "#1E1E1A",
  surfaceSelected: "#22331F",
  border: "#3A392F",
  borderSelected: "#5FA968",
  text: "#F2F1EA",
  textMuted: "#B5B2A4",
  textOnPrimary: "#0E1710",
  primary: "#5FA968",
  primaryPressed: "#4C8A54",
  danger: "#E5766E",
  dangerPressed: "#C25A52",
  disabled: "#3A392F",
  disabledText: "#7A7768",
  bannerErrorBg: "#3A1F1B",
  bannerErrorText: "#F3B4AD",
  bannerInfoBg: "#233024",
  bannerInfoText: "#D3DED0",
};

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
