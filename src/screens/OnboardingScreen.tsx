import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import type { TextInput } from "react-native";
import { getDatabase } from "@/db/client";
import { hamtaEllerSkapaProfil, uppdateraProfilNamn } from "@/db/queries/profil";
import { skapaHund } from "@/db/queries/hund";
import type { Profil } from "@/db/types";
import { InlineBanner } from "@/components/InlineBanner";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { StartInloggning } from "@/components/konto/StartInloggning";
import { kontoKlient } from "@/konto/klient";

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
 *
 * 2026-11-16: man kan logga in med Apple eller Google direkt här
 * (StartInloggning), både i appen och på webben. Inloggad fylls namnet i
 * från kontot och hunden blir frivillig - den som bara ska planera i ett
 * jaktlag behöver ingen hund. Utan hund visar Välj hund och Hundar redan
 * en uppmaning att lägga till en.
 */
export function OnboardingScreen({ profil, onKlar }: OnboardingScreenProps) {
  const hundFalt = useRef<TextInput>(null);
  const [namn, setNamn] = useState("");
  const [hundNamn, setHundNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [inloggad, setInloggad] = useState(false);

  // Inloggad: namnet från kontot fylls i (om fältet är tomt) och hunden blir frivillig.
  const onKonto = useCallback((konto: { namn: string } | null) => {
    setInloggad(!!konto);
    if (konto?.namn) {
      setNamn((nu) => (nu.trim() === "" ? konto.namn : nu));
    }
  }, []);

  const kanSpara = namn.trim().length > 0 && (inloggad || hundNamn.trim().length > 0);

  const komIgang = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraProfilNamn(db, profil.id, namn.trim());
      if (hundNamn.trim()) {
        await skapaHund(db, { profilId: profil.id, namn: hundNamn.trim() });
      }
      // Apple skickar bara namnet första gången man loggar in. Saknas det på
      // kontot får kontot namnet från startskärmen.
      if (inloggad) {
        const { data } = await kontoKlient.getSession().catch(() => ({ data: null }));
        if (data?.user && !data.user.name?.trim()) {
          await kontoKlient.updateUser({ name: namn.trim() }).catch(() => {});
        }
      }
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

        <StartInloggning onKonto={onKonto} />

        <Txt variant="bodyStrong">
          {inloggad
            ? "Ditt namn och din första hund"
            : "Innan du kör igång behöver vi ditt namn och namnet på din första hund."}
        </Txt>

        {/* Inget autoFocus: tangentbordet ska inte täcka introtexten och
            Kom igång-knappen innan man själv trycker i ett fält. */}
        <Falt
          etikett="Ditt namn"
          value={namn}
          onChangeText={setNamn}
          placeholder="T.ex. Filip"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => hundFalt.current?.focus()}
        />
        <Falt
          ref={hundFalt}
          etikett={inloggad ? "Din hunds namn (frivilligt)" : "Din hunds namn"}
          value={hundNamn}
          onChangeText={setHundNamn}
          placeholder="T.ex. Aston"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={komIgang}
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
