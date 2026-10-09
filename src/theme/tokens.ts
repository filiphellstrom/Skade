import type { TextStyle } from "react-native";

/**
 * Skades designtokens, överförda från Design Systemets tokens.json
 * (https://claude.ai/artifact/HzC8A5KnjQTXCfBuSTDnZM, se även
 * claude/design-lyft-beslut.md i projektet).
 *
 * REGEL: inga hex-värden i komponenter eller skärmar. Läs alltid färgen
 * via namn från temat (useTema().farger.brand osv.) så att ljust och
 * mörkt byts på ett ställe - här.
 */

export interface Farger {
  /** Sidans bakgrund på alla skärmar, även timern. */
  surface100: string;
  /** Kort, listrader, flikfält och ark som lyfter från surface100. */
  surface200: string;
  /** Nedsänkta ytor: chips, sekundära knappar, fält, ej vald segmentknapp. */
  surface300: string;
  /** All primär text och ikoner. */
  ink: string;
  /** Sekundär text, etiketter, inaktiva flikar. Aldrig för fältläget. */
  inkMuted: string;
  /** Dekorativa skiljelinjer mellan listrader. */
  border: string;
  /** Kant på inmatningsfält och ej valda val-kort (minst 3:1). */
  borderStrong: string;
  /** Skades enda huvudfärg. */
  brand: string;
  /** Text och ikon på brand-fyllning. */
  onBrand: string;
  /** Mjuk grön yta: valt tillstånd, pågående jaktdag. */
  brandSoft: string;
  /** Endast Stoppa drev samt radera/arkivera, och felmeddelanden. */
  signal: string;
  /** Text och ikon på signal-fyllning. */
  onSignal: string;
  /** Datafärg i statistik. Aldrig för knappar. */
  frost: string;
  /** Mjuka påminnelser, alltid på warnSoft. */
  warn: string;
  warnSoft: string;
}

export type Schema = "light" | "dark";

export const FARGER: Record<Schema, Farger> = {
  light: {
    surface100: "#f4f6f5",
    surface200: "#ffffff",
    surface300: "#e7ece9",
    ink: "#14201b",
    inkMuted: "#55635c",
    border: "#d5ddd8",
    // Mörkare än designens #7e8f86, som gav 2,85:1 mot surface300 (krav 3:1
    // för kontrollkanter). #74857c ger 3,26:1 / 3,59:1 / 3,90:1 mot
    // surface300/100/200. Godkänt av Filip 2026-10-09.
    borderStrong: "#74857c",
    brand: "#1f4d3a",
    onBrand: "#ffffff",
    brandSoft: "#dde9e3",
    signal: "#b4361f",
    onSignal: "#ffffff",
    frost: "#356f86",
    warn: "#7a4e00",
    warnSoft: "#fbefd2",
  },
  dark: {
    surface100: "#0f1613",
    surface200: "#17211c",
    surface300: "#202d27",
    ink: "#eaf0ed",
    inkMuted: "#9daea5",
    border: "#26332d",
    borderStrong: "#6b7e74",
    brand: "#7fc4a0",
    onBrand: "#0b1a12",
    brandSoft: "#1e3a2d",
    signal: "#ff8a70",
    onSignal: "#2a0e08",
    frost: "#8cc3d6",
    warn: "#f2c46b",
    warnSoft: "#3a2e10",
  },
};

/** Kortskugga: bara i ljust läge, i mörkt skiljer ytorna sig med färg. */
export const KORT_SKUGGA: Record<Schema, string | undefined> = {
  light: "0px 1px 2px rgba(20,32,27,0.06), 0px 6px 20px rgba(20,32,27,0.06)",
  dark: undefined,
};

export const avstand = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
} as const;

/** Tryckytornas höjder. */
export const tryck = {
  /** Minsta höjd i vardagsläge. */
  min: 56,
  /** Endast Arkivera hund, Radera hund och Radera drev - medveten broms. */
  liten: 36,
  /** Starta/Stoppa drev i fältläge, för jakthandskar. */
  falt: 96,
} as const;

export const radie = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * Schibsted Grotesk finns bara i hela vikter. Designens 650 (knapptext)
 * blir 600 och 750 (fältknappar) blir 700.
 */
export const FONT = {
  400: "SchibstedGrotesk_400Regular",
  500: "SchibstedGrotesk_500Medium",
  600: "SchibstedGrotesk_600SemiBold",
  700: "SchibstedGrotesk_700Bold",
  800: "SchibstedGrotesk_800ExtraBold",
} as const;

function stil(
  vikt: keyof typeof FONT,
  fontSize: number,
  lineHeight: number,
  letterSpacingEm = 0,
): TextStyle {
  return {
    fontFamily: FONT[vikt],
    fontSize,
    lineHeight,
    letterSpacing: letterSpacingEm * fontSize,
  };
}

/** Typstilarna i Design Systemet, samma namn (camelCase). */
export const typ = {
  display: stil(800, 44, 46, -0.02),
  title1: stil(700, 30, 36, -0.01),
  title2: stil(700, 22, 28),
  heading: stil(600, 18, 24),
  body: stil(400, 16, 24),
  bodyStrong: stil(600, 16, 24),
  caption: stil(500, 13, 18),
  /** Skriv texten i versaler själv - stilen ändrar inte skiftläge. */
  label: stil(700, 12, 16, 0.06),
  button: stil(600, 17, 22),
  buttonField: stil(700, 26, 30),
  timerNumeral: {
    ...stil(700, 96, 96, -0.02),
    fontVariant: ["tabular-nums"],
  } as TextStyle,
} as const;

export type TypNamn = keyof typeof typ;
