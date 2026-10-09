import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { skapaHund } from "@/db/queries/hund";
import { useProfil } from "@/contexts/ProfilContext";
import { InlineBanner } from "@/components/InlineBanner";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

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
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Skarm>
        <Txt variant="title1" accessibilityRole="header">
          Lägg till hund
        </Txt>

        <Falt
          etikett="Namn"
          value={namn}
          onChangeText={setNamn}
          placeholder="T.ex. Aston"
          autoCapitalize="words"
          autoFocus
          onSubmitEditing={sparaHund}
          returnKeyType="done"
        />

        {fel && <InlineBanner text={fel} typ="error" />}

        <View style={styles.knappblock}>
          <Knapp titel="Spara hund" onPress={sparaHund} disabled={!kanSpara} laddar={sparar} />
          <Knapp titel="Avbryt" variant="sekundar" onPress={() => router.back()} />
        </View>
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  knappblock: { gap: avstand.s3 },
});
