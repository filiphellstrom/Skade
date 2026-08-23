import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface ScreenHeaderProps {
  jaktmark: string;
  datum: Date;
}

/**
 * Liten kontextrad överst på "Välj hund" och "Timer" - man ska alltid se
 * vilken jaktdag man är i, utan att det tar fokus från huvudknappen
 * längre ner på skärmen.
 */
export function ScreenHeader({ jaktmark, datum }: ScreenHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Text style={[styles.jaktmark, { color: colors.text }]} numberOfLines={1}>
        {jaktmark}
      </Text>
      <Text style={[styles.datum, { color: colors.textMuted }]}>
        {datum.toLocaleDateString("sv-SE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 20,
  },
  jaktmark: {
    fontSize: 20,
    fontWeight: "700",
  },
  datum: {
    fontSize: 14,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
