import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { skapaJaktmark } from "@/db/queries/jaktmark";
import { useProfil } from "@/contexts/ProfilContext";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/** Lägg till jaktmark från Jaktmarker-fliken (utan att starta en jaktdag). */
export default function NyJaktmark() {
  const { profil } = useProfil();
  const [namn, setNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const kanSpara = namn.trim().length > 0;

  const spara = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await skapaJaktmark(db, profil.id, namn);
      router.back();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara jaktmarken. Försök igen.");
      setSparar(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm>
        <Txt variant="title1" accessibilityRole="header">
          Lägg till jaktmark
        </Txt>
        <Falt
          etikett="Namn"
          value={namn}
          onChangeText={setNamn}
          placeholder="T.ex. Storskogen"
          autoCapitalize="sentences"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={spara}
        />
        {fel && <InlineBanner text={fel} typ="error" />}
        <View style={styles.knappar}>
          <Knapp titel="Spara jaktmark" onPress={spara} disabled={!kanSpara} laddar={sparar} />
          <Knapp titel="Avbryt" variant="sekundar" onPress={() => router.back()} />
        </View>
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  knappar: { gap: avstand.s3 },
});
