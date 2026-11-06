/**
 * Vindriktning (Vind och vittring, 2026-11-06).
 *
 * METEOROLOGISK STANDARD: vindriktning anges som den riktning vinden
 * kommer IFRÅN, i grader medurs från geografisk nord. 270° = västlig vind,
 * som kommer från väster och blåser MOT öster (90°).
 *
 * Allt som ritas på kartan (pilar, vittringszon) använder däremot
 * riktningen vinden blåser MOT. Den enda platsen omvandlingen görs är
 * blaserMot() nedan - använd den, räkna aldrig +180 för hand någon
 * annanstans.
 *
 * Ren kod utan beroenden, så att den kan testas med node (se __tests__).
 */

/** Normaliserar en vinkel till [0, 360). */
export function normalisera(grader: number): number {
  const v = ((grader % 360) + 360) % 360;
  // Flyttalsfel (t.ex. -1e-15 → 360) och -0 ska bli exakt 0.
  return v >= 360 - 1e-9 || v === 0 ? 0 : v;
}

/** Från meteorologisk riktning (varifrån) till kartriktning (vart vinden blåser). */
export function blaserMot(franGrader: number): number {
  return normalisera(franGrader + 180);
}

/** Minsta vinkelskillnad mellan två riktningar, 0-180°. */
export function vinkelskillnad(a: number, b: number): number {
  const d = Math.abs(normalisera(a) - normalisera(b));
  return d > 180 ? 360 - d : d;
}

const STRECK_16 = [
  "N",
  "NNO",
  "NO",
  "ONO",
  "O",
  "OSO",
  "SO",
  "SSO",
  "S",
  "SSV",
  "SV",
  "VSV",
  "V",
  "VNV",
  "NV",
  "NNV",
];

const NAMN_8: Record<string, string> = {
  N: "norr",
  NO: "nordost",
  O: "öster",
  SO: "sydost",
  S: "söder",
  SV: "sydväst",
  V: "väster",
  NV: "nordväst",
};

/** Kompasstreck med svenska bokstäver (O = öst), 16 streck. 270 → "V". */
export function kompassStreck(grader: number): string {
  return STRECK_16[Math.round(normalisera(grader) / 22.5) % 16];
}

/** Väderstreck i ord, 8 streck. 270 → "väster". */
export function riktningsNamn(grader: number): string {
  const streck = ["N", "NO", "O", "SO", "S", "SV", "V", "NV"][
    Math.round(normalisera(grader) / 45) % 8
  ];
  return NAMN_8[streck];
}

/**
 * "Vind från väster – blåser mot öster" för en meteorologisk riktning.
 * Tydlig text i panelen så att ingen behöver tänka på konventionen.
 */
export function riktningsText(franGrader: number): string {
  return `Vind från ${riktningsNamn(franGrader)} – blåser mot ${riktningsNamn(blaserMot(franGrader))}`;
}

/**
 * Cirkulärt medelvärde av riktningar (grader). Används för att jämföra
 * prognosens timmar runt vald tid. Returnerar null för tom lista.
 */
export function medelriktning(grader: number[]): number | null {
  if (grader.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const g of grader) {
    const r = (g * Math.PI) / 180;
    x += Math.sin(r);
    y += Math.cos(r);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  return normalisera((Math.atan2(x, y) * 180) / Math.PI);
}
