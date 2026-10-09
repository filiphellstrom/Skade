import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil, uppdateraProfilNamn } from "@/db/queries/profil";
import { skapaHund } from "@/db/queries/hund";
import type { Profil } from "@/db/types";
import { InlineBanner } from "@/components/InlineBanner";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

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
 * behöver förstå VAD appen gör innan de bara möts av två textfält. Samma
 * dag: en kort kursiv rad tillagd om varifrån namnet "Skade" kommer
 * (jaktens gudinna i nordisk mytologi) - medvetet mindre/kursiv stil
 * (styles.namnfakta) för att skilja den lilla kuriosan från den
 * funktionella introtexten ovanför och instruktionsraden nedanför.
 */
export function OnboardingScreen({ profil, onKlar }: OnboardingScreenProps) {
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
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Skarm>
        <View style={styles.rubrikblock}>
          <Txt variant="display" accessibilityRole="header">
            Skade
          </Txt>
          <Txt variant="body" farg="inkMuted">
            Skade är din digitala jaktdagbok - ta tiden på varje drev, se vilket vilt som drevs, och
            håll koll på dina hundars insatser över tid.
          </Txt>
          <Txt variant="caption" farg="inkMuted">
            Appen är uppkallad efter Skade, jaktens gudinna i nordisk mytologi.
          </Txt>
        </View>

        <Txt variant="bodyStrong">
          Innan du kör igång behöver vi ditt namn och namnet på din första hund.
        </Txt>

        <Falt
          etikett="Ditt namn"
          value={namn}
          onChangeText={setNamn}
          placeholder="T.ex. Filip"
          autoCapitalize="words"
          autoFocus
        />
        <Falt
          etikett="Din hunds namn"
          value={hundNamn}
          onChangeText={setHundNamn}
          placeholder="T.ex. Aston"
          autoCapitalize="words"
        />

        {fel && <InlineBanner text={fel} typ="error" />}

        <Knapp titel="Kom igång" onPress={komIgang} disabled={!kanSpara} laddar={sparar} />
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rubrikblock: { gap: avstand.s2 },
});
