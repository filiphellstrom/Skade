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
import { skapaJaktdag } from "@/db/queries/jaktdag";
import { useProfil } from "@/contexts/ProfilContext";
import { BackButton } from "@/components/BackButton";
import { BigButton } from "@/components/BigButton";
import { InlineBanner } from "@/components/InlineBanner";
import { useThemeColors } from "@/theme/colors";

function idagVidMidnatt(): number {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  return Math.floor(nu.getTime() / 1000);
}

/**
 * Sida 1: Ny jaktdag. Sparar direkt via skapaJaktdag() - inget
 * "utkast"-läge, se beslutat sparflöde i 0001_init.ts-headern (varje steg
 * sparar direkt till databasen).
 *
 * Datum är alltid dagens datum (beslutat i Sprint 2, 2026-08-23) - ingen
 * anledning att kunna välja ett annat datum, så inget UI för det. Jaktmark
 * är därmed enda fältet. Den tidigare datumväljaren (DateField-komponenten)
 * finns kvar i src/components/ ifall den behövs igen (t.ex. filtrering i en
 * framtida historikvy), men används inte längre här.
 */
export default function NyJaktdag() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  const [jaktmark, setJaktmark] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const kanSpara = jaktmark.trim().length > 0;

  const starta = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const jaktdag = await skapaJaktdag(db, {
        profilId: profil.id,
        datum: idagVidMidnatt(),
        jaktmark: jaktmark.trim(),
      });
      router.replace(`/jaktdag/${jaktdag.id}/valj-hund`);
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte skapa jaktdagen.",
      );
      setSparar(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.backRad}>
        <BackButton />
      </View>

      <View style={styles.innehall}>
        <Text style={[styles.rubrik, { color: colors.text }]}>
          Ny jaktdag
        </Text>

        <View style={styles.falt}>
          <Text style={[styles.etikett, { color: colors.text }]}>
            Jaktmark
          </Text>
          <TextInput
            value={jaktmark}
            onChangeText={setJaktmark}
            placeholder="T.ex. Storskogen"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="sentences"
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
            label="Starta jaktdag"
            onPress={starta}
            disabled={!kanSpara}
            laddar={sparar}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRad: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  innehall: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 24,
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
  knappblock: { marginTop: 4 },
});
