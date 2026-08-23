import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { skapaHund } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import { BigButton } from "@/components/BigButton";
import { InlineBanner } from "@/components/InlineBanner";
import { useThemeColors } from "@/theme/colors";

/**
 * Lägg till en (ytterligare) hund. Första hunden skapas redan i
 * OnboardingScreen vid första körning - den här skärmen är för fler
 * hundar senare, länkad från "Välj hund"-listans tomt-state/
 * "Lägg till hund"-länk (se app/jaktdag/[jaktdagId]/valj-hund.tsx).
 *
 * `jaktdagId` skickas med som query-param när skärmen öppnas därifrån, så
 * vi kan navigera tillbaka dit efteråt - `valj-hund.tsx` hämtar om
 * hundlistan varje gång skärmen får fokus, så den nya hunden dyker upp
 * automatiskt.
 */
export default function NyHund() {
  const colors = useThemeColors();
  const { profil } = useProfil();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId?: string }>();

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

      if (jaktdagId) {
        router.replace(`/jaktdag/${jaktdagId}/valj-hund`);
      } else {
        router.back();
      }
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
            placeholder="T.ex. Bella"
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
