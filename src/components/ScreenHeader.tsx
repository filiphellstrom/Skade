import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";
import { BackButton } from "@/components/BackButton";

interface ScreenHeaderProps {
  jaktmark: string;
  datum: Date;
  /**
   * Visar en stor tillbaka-knapp ovanför jaktmark/datum. Använder
   * BackButtons eget standardbeteende (ett steg bakåt, eller till
   * huvudskärmen om det inte går) - skicka bara true/false, ingen egen
   * navigeringslogik behöver upprepas vid varje anropsställe.
   */
  visaTillbaka?: boolean;
}

/**
 * Liten kontextrad överst på "Välj hund" och "Timer" - man ska alltid se
 * vilken jaktdag man är i, utan att det tar fokus från huvudknappen
 * längre ner på skärmen.
 */
export function ScreenHeader({ jaktmark, datum, visaTillbaka }: ScreenHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {visaTillbaka && <BackButton />}
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
