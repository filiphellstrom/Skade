import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { useTema } from "@/theme/TemaContext";
import { FONT } from "@/theme/tokens";
import { blaserMot } from "@/vind/riktning";

/**
 * Kompassros för panelen. Pilen pekar dit vinden BLÅSER (samma som på
 * kartan), med en liten markering på ringen där vinden kommer ifrån.
 * Utan riktning visas bara ringen.
 */
export function Kompass({ franGrader, storlek = 64 }: { franGrader: number | null; storlek?: number }) {
  const { farger } = useTema();
  const mot = franGrader === null ? null : blaserMot(franGrader);
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Circle cx={32} cy={32} r={27} stroke={farger.borderStrong} strokeWidth={1.5} fill={farger.surface200} />
      {[0, 90, 180, 270].map((v) => (
        <Path
          key={v}
          d="M32 6v4"
          stroke={farger.inkMuted}
          strokeWidth={1.5}
          strokeLinecap="round"
          transform={`rotate(${v} 32 32)`}
        />
      ))}
      <SvgText x={32} y={20} fontSize={9} fontFamily={FONT[700]} fill={farger.inkMuted} textAnchor="middle">
        N
      </SvgText>
      {mot !== null && franGrader !== null && (
        <>
          {/* Varifrån: liten prick på ringen. */}
          <G transform={`rotate(${franGrader} 32 32)`}>
            <Circle cx={32} cy={5} r={3} fill={farger.inkMuted} />
          </G>
          {/* Vart: pilen. */}
          <G transform={`rotate(${mot} 32 32)`}>
            <Path d="M32 46V18" stroke={farger.brand} strokeWidth={3.5} strokeLinecap="round" />
            <Path d="M24 25l8-9 8 9" stroke={farger.brand} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        </>
      )}
    </Svg>
  );
}
