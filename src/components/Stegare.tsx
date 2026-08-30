import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface StegareProps {
  label: string;
  varde: string;
  onMinus: () => void;
  onPlus: () => void;
}

/**
 * Delad ‹ värde › -stegare - bruten ut ur BirthDateField (Sprint 3, för
 * födelsedatum) när samma mönster behövdes igen för periodfiltrets
 * år-/datumval (DatumField.tsx, PeriodFilter.tsx). Ingen egen state -
 * bara en tryckbar rad, föräldern äger värdet och bestämmer vad
 * onMinus/onPlus faktiskt ska ändra.
 */
export function Stegare({ label, varde, onMinus, onPlus }: StegareProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.block, { borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.rad}>
        <Pressable
          accessibilityRole="button"
          onPress={onMinus}
          style={styles.knapp}
          hitSlop={8}
        >
          <Text style={[styles.pil, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.varde, { color: colors.text }]}>{varde}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPlus}
          style={styles.knapp}
          hitSlop={8}
        >
          <Text style={[styles.pil, { color: colors.text }]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  label: { fontSize: 12, fontWeight: "600" },
  rad: { flexDirection: "row", alignItems: "center" },
  knapp: { paddingHorizontal: 10, paddingVertical: 8 },
  pil: { fontSize: 22, fontWeight: "700" },
  varde: { fontSize: 16, fontWeight: "700", minWidth: 36, textAlign: "center" },
});
