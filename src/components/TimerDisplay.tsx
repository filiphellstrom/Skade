import { StyleSheet, View } from "react-native";
import { Txt } from "@/components/ui/Txt";
import { formateraTid } from "@/hooks/useElapsedTime";
import { avstand } from "@/theme/tokens";

interface TimerDisplayProps {
  sekunder: number;
  pagar: boolean;
  /** Ersätter "Drevet pågår"/"Redo att starta", t.ex. "Söker 12:34" eller "Tappt 2:13". */
  status?: string | null;
}

/** Drevtiden i timer-numeral med tabulära siffror. */
export function TimerDisplay({ sekunder, pagar, status }: TimerDisplayProps) {
  return (
    <View style={styles.container} accessibilityRole="timer">
      <Txt variant="timerNumeral" farg={pagar ? "ink" : "inkMuted"} adjustsFontSizeToFit numberOfLines={1}>
        {formateraTid(sekunder)}
      </Txt>
      <Txt variant={status ? "bodyStrong" : "caption"} farg={status ? "ink" : "inkMuted"}>
        {status ?? (pagar ? "Drevet pågår" : "Redo att starta")}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: avstand.s4 },
});
