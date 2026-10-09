import { StyleSheet, View } from "react-native";
import { Txt } from "@/components/ui/Txt";
import { formateraTid } from "@/hooks/useElapsedTime";
import { avstand } from "@/theme/tokens";

interface TimerDisplayProps {
  sekunder: number;
  pagar: boolean;
}

/** Drevtiden i timer-numeral med tabulära siffror. */
export function TimerDisplay({ sekunder, pagar }: TimerDisplayProps) {
  return (
    <View style={styles.container} accessibilityRole="timer">
      <Txt variant="timerNumeral" farg={pagar ? "ink" : "inkMuted"} adjustsFontSizeToFit numberOfLines={1}>
        {formateraTid(sekunder)}
      </Txt>
      <Txt variant="caption" farg="inkMuted">
        {pagar ? "Drevet pågår" : "Redo att starta"}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: avstand.s4 },
});
