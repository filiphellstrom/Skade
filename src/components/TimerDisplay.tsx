import { StyleSheet, Text, View } from "react-native";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

interface TimerDisplayProps {
  sekunder: number;
  pagar: boolean;
}

/**
 * Stor monospace-siffervisning för drevtid - läsbar i dåligt ljus/på
 * avstånd, per UX-principerna. `pagar` styr bara accentfärgen (grön =
 * drev igång), inte själva tickandet - det sköts av useElapsedTime.
 */
export function TimerDisplay({ sekunder, pagar }: TimerDisplayProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.siffror,
          { color: pagar ? colors.primary : colors.text },
        ]}
      >
        {formateraTid(sekunder)}
      </Text>
      <Text style={[styles.status, { color: colors.textMuted }]}>
        {pagar ? "Drev pågår" : "Inget drev pågår"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  siffror: {
    fontSize: 72,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  status: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
  },
});
