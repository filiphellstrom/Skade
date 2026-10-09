import { StyleSheet, View } from "react-native";
import { TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { avstand } from "@/theme/tokens";

interface ScreenHeaderProps {
  jaktmark: string;
  datum: Date;
  /** Visar en stor Tillbaka-knapp ovanför jaktmarken. */
  visaTillbaka?: boolean;
  /** Valfri rubrik under kontextraden (t.ex. "Välj hundar som ska jaga"). */
  titel?: string;
}

/**
 * Kontextrad överst i jaktdagsflödet - man ska alltid se vilken jaktmark
 * och dag man jobbar med. Jaktmarken i title2, datumet i caption.
 */
export function ScreenHeader({ jaktmark, datum, visaTillbaka, titel }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {visaTillbaka && <TillbakaKnapp />}
      <View>
        <Txt variant="label" farg="inkMuted">
          {datum
            .toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })
            .toUpperCase()}
        </Txt>
        <Txt variant="title2" style={styles.mark}>
          {jaktmark}
        </Txt>
      </View>
      {!!titel && (
        <Txt variant="title1" accessibilityRole="header">
          {titel}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: avstand.s4 },
  mark: { marginTop: avstand.s1 },
});
