import Svg, { Circle, Path, Rect } from "react-native-svg";
import type { ReactNode } from "react";

/**
 * Linjeikoner enligt designen: 24 px, 1,75 px linje, runda ändar.
 * Bara "spela" och "stopp" är fyllda (timerns knappar).
 *
 * Ritade efter Design Systemets förhandsvisningar (TabBar, TimerPanel)
 * och skärmarna - inget externt ikonbibliotek, så att alla ikoner har
 * exakt samma linje och storlek.
 */
export type IkonNamn =
  | "hem"
  | "hund"
  | "historik"
  | "jaktmark"
  | "installningar"
  | "plus"
  | "tillbaka"
  | "framat"
  | "spela"
  | "stopp"
  | "mane"
  | "sol"
  | "varning"
  | "bock"
  | "dela";

interface Props {
  namn: IkonNamn;
  farg: string;
  storlek?: number;
  /** Linjetjocklek, standard 1,75. */
  linje?: number;
}

export function Ikon({ namn, farg, storlek = 24, linje = 1.75 }: Props) {
  const fylld = namn === "spela" || namn === "stopp";
  return (
    <Svg
      width={storlek}
      height={storlek}
      viewBox="0 0 24 24"
      fill={fylld ? farg : "none"}
      stroke={fylld ? "none" : farg}
      strokeWidth={linje}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {INNEHALL[namn]}
    </Svg>
  );
}

const INNEHALL: Record<IkonNamn, ReactNode> = {
  hem: <Path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  hund: (
    <>
      <Circle cx="6.5" cy="10" r="1.8" />
      <Circle cx="10.5" cy="6" r="1.8" />
      <Circle cx="15.5" cy="6" r="1.8" />
      <Circle cx="19" cy="10" r="1.8" />
      <Path d="M12.5 11.5c-3 0-6 3-6 5.5 0 2 1.6 3 3.5 3 1 0 1.8-.3 2.5-.3s1.5.3 2.5.3c1.9 0 3.5-1 3.5-3 0-2.5-3-5.5-6-5.5z" />
    </>
  ),
  historik: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  jaktmark: (
    <>
      <Path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </>
  ),
  installningar: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  tillbaka: <Path d="M15 5l-7 7 7 7" />,
  framat: <Path d="M9 5l7 7-7 7" />,
  spela: <Path d="M7 4.5v15l13-7.5z" />,
  stopp: <Rect x="5" y="5" width="14" height="14" rx="2" />,
  mane: <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sol: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  varning: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v6M12 16.5v.5" />
    </>
  ),
  bock: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  dela: (
    <>
      <Path d="M12 3v12" />
      <Path d="M7.5 7.5L12 3l4.5 4.5" />
      <Path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>
  ),
};
