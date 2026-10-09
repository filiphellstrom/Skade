import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktmark, uppdateraJaktmark } from "@/db/queries/jaktmark";
import type { Jaktmark } from "@/db/types";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Döp om en jaktmark. Namnet ändras överallt (jaktdagar pekar på marken
 * via jaktmarkId). Ett namn som redan finns ger ett tydligt fel.
 * Ingen radering i den här sprinten - jaktdagar kräver en jaktmark.
 */
export default function RedigeraJaktmark() {
  const f = useFarger();
  const { jaktmarkId } = useLocalSearchParams<{ jaktmarkId: string }>();
  const [mark, setMark] = useState<Jaktmark | null>(null);
  const [namn, setNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const m = await hamtaJaktmark(db, jaktmarkId);
        if (!avbruten && m) {
          setMark(m);
          setNamn(m.namn);
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [jaktmarkId]),
  );

  const kanSpara = !!mark && namn.trim().length > 0 && namn.trim() !== mark.namn;

  const spara = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraJaktmark(db, jaktmarkId, { namn });
      router.back();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte byta namn. Försök igen.");
      setSparar(false);
    }
  };

  if (!mark) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm>
        <View style={styles.topp}>
          <TillbakaKnapp />
          <Txt variant="title1" accessibilityRole="header">
            {mark.namn}
          </Txt>
        </View>
        <Falt
          etikett="Namn"
          value={namn}
          onChangeText={setNamn}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={spara}
        />
        <Txt variant="caption" farg="inkMuted">
          Namnet ändras på alla jaktdagar som hör till marken.
        </Txt>
        {fel && <InlineBanner text={fel} typ="error" />}
        <Knapp titel="Spara namn" onPress={spara} disabled={!kanSpara} laddar={sparar} />
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  topp: { gap: avstand.s4 },
});
