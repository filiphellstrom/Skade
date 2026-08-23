import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useProfil } from "@/contexts/ProfilContext";
import { BigButton } from "@/components/BigButton";
import { useThemeColors } from "@/theme/colors";

/**
 * Huvudskärm - minimal version för Sprint 1. Ger bara navigationsentrén
 * in i flödet ("Ny jaktdag"), eftersom onboardingen (se
 * OnboardingScreen/app/_layout.tsx) garanterar att profilen och minst en
 * hund redan finns när man når hit.
 *
 * Riktig hundlista/senaste-jaktdag/statistik (se projektbeskrivningen)
 * byggs i en senare sprint - inte del av de tre skärmar som beställdes
 * här.
 */
export default function HuvudSkarm() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.innehall}>
        <Text style={[styles.halsning, { color: colors.textMuted }]}>
          Hej, {profil.namn}
        </Text>
        <Text style={[styles.rubrik, { color: colors.text }]}>Skade</Text>
      </View>

      <View style={styles.knappblock}>
        <BigButton
          label="Ny jaktdag"
          onPress={() => router.push("/jaktdag/ny")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  innehall: {
    flex: 1,
    justifyContent: "center",
  },
  halsning: {
    fontSize: 16,
    fontWeight: "600",
  },
  rubrik: {
    fontSize: 40,
    fontWeight: "800",
    marginTop: 4,
  },
  knappblock: {
    gap: 12,
  },
});
