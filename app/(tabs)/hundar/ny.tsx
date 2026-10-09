import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { skapaHund } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import { BigButton } from "@/components/BigButton";
import { InlineBanner } from "@/components/InlineBanner";
import { useThemeColors } from "@/theme/colors";

/**
 * Lägg till en (ytterligare) hund. Första hunden skapas redan i
 * OnboardingScreen vid första körning - den här skärmen är för fler
 * hundar senare.
 *
 * Sprint 6: används på två ställen - Hundar-fliken (/hundar/ny) och
 * jaktdagsflödet (/jaktdag/[jaktdagId]/ny-hund, som återanvänder den här
 * komponenten så att flikfältet inte dyker upp mitt i flödet). Efter Spara
 * går man tillbaka dit man kom ifrån; båda listorna hämtas om vid fokus.
 */
export default function NyHund() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  const [namn, setNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const kanSpara = namn.trim().length > 0;

  const sparaHund = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await skapaHund(db, { profilId: profil.id, namn: namn.trim() });

      // Tillbaka till där man kom ifrån - Hundar-fliken eller "Välj hundar
      // som ska jaga" i jaktdagsflödet. Båda hämtar om listan vid fokus.
      router.back();
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte spara hunden.",
      );
      setSparar(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.innehall}>
        <Text style={[styles.rubrik, { color: colors.text }]}>
          Lägg till hund
        </Text>

        <View style={styles.falt}>
          <Text style={[styles.etikett, { color: colors.text }]}>Namn</Text>
          <TextInput
            value={namn}
            onChangeText={setNamn}
            placeholder="T.ex. Aston"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoFocus
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />
        </View>

        {fel && <InlineBanner text={fel} typ="error" />}

        <View style={styles.knappblock}>
          <BigButton
            label="Spara hund"
            onPress={sparaHund}
            disabled={!kanSpara}
            laddar={sparar}
          />
          <BigButton
            label="Avbryt"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  innehall: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  rubrik: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  falt: { gap: 8 },
  etikett: { fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
  },
  knappblock: { marginTop: 12, gap: 12 },
});
