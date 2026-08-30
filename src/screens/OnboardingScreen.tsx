import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil, uppdateraProfilNamn } from "@/db/queries/profil";
import { skapaHund } from "@/db/queries/hund";
import type { Profil } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { InlineBanner } from "@/components/InlineBanner";
import { useThemeColors } from "@/theme/colors";

interface OnboardingScreenProps {
  profil: Profil;
  onKlar: (uppdateradProfil: Profil) => void;
}

/**
 * Tvingande första-körning-flöde (beslutat i chatten "Skade – Sprint 1",
 * 2026-08-23): appen skapar alltid en Profil-rad automatiskt i bakgrunden
 * (se hamtaEllerSkapaProfil, anropas redan i app/_layout.tsx innan denna
 * skärm visas), men ett tomt profilnamn är signalen att användaren aldrig
 * kört appen förut. Den här skärmen kräver då både ett eget namn och
 * namnet på den första hunden innan resten av appen blir tillgänglig -
 * annars skulle "Välj hund"-listan vara tom direkt vid första körning.
 *
 * Renderas direkt av app/_layout.tsx (inte via router.replace) så det inte
 * finns någon "bakåt"-väg ut ur onboardingen.
 *
 * Sprint 4 (2026-08-30): kort introtext tillagd ovanför fälten - tips från
 * Filips fru om att nya användare (t.ex. vänner som testar webbversionen)
 * behöver förstå VAD appen gör innan de bara möts av två textfält.
 */
export function OnboardingScreen({ profil, onKlar }: OnboardingScreenProps) {
  const colors = useThemeColors();
  const [namn, setNamn] = useState("");
  const [hundNamn, setHundNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const kanSpara = namn.trim().length > 0 && hundNamn.trim().length > 0;

  const komIgang = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraProfilNamn(db, profil.id, namn.trim());
      await skapaHund(db, { profilId: profil.id, namn: hundNamn.trim() });
      const uppdateradProfil = await hamtaEllerSkapaProfil(db);
      onKlar(uppdateradProfil);
    } catch (e) {
      setFel(
        e instanceof Error
          ? e.message
          : "Något gick fel när profilen skulle sparas.",
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
        <View style={styles.rubrikblock}>
          <Text style={[styles.rubrik, { color: colors.text }]}>
            Välkommen till Skade
          </Text>
          <Text style={[styles.intro, { color: colors.textMuted }]}>
            Skade är din digitala jaktdagbok - ta tiden på varje drev, se
            vilket vilt som drevs, och håll koll på dina hundars insatser
            över tid.
          </Text>
          <Text style={[styles.ingress, { color: colors.textMuted }]}>
            Innan du kör igång behöver vi ditt namn och namnet på din första
            hund.
          </Text>
        </View>

        <View style={styles.falt}>
          <Text style={[styles.etikett, { color: colors.text }]}>
            Ditt namn
          </Text>
          <TextInput
            value={namn}
            onChangeText={setNamn}
            placeholder="T.ex. Filip"
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

        <View style={styles.falt}>
          <Text style={[styles.etikett, { color: colors.text }]}>
            Din hunds namn
          </Text>
          <TextInput
            value={hundNamn}
            onChangeText={setHundNamn}
            placeholder="T.ex. Bella"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
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
            label="Kom igång"
            onPress={komIgang}
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
  innehall: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  rubrikblock: { gap: 8, marginBottom: 12 },
  rubrik: { fontSize: 28, fontWeight: "800" },
  intro: { fontSize: 16, lineHeight: 22 },
  ingress: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  falt: { gap: 8 },
  etikett: { fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
  },
  knappblock: { marginTop: 12 },
});
