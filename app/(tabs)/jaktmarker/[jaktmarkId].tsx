import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktmark, settJaktmarkPosition, uppdateraJaktmark } from "@/db/queries/jaktmark";
import { fragaOmPlats, hamtaPosition } from "@/utils/vader";
import type { Jaktmark } from "@/db/types";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Falt, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { KartdataKort } from "@/components/karta/KartdataKort";

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
  const [hamtarPos, setHamtarPos] = useState(false);
  const [posFel, setPosFel] = useState<string | null>(null);

  // 2026-11-04: jaktmarkens ungefärliga position, för SMHI-vädret.
  const andraPosition = async (anvand: boolean) => {
    if (!mark || hamtarPos) return;
    setPosFel(null);
    setHamtarPos(true);
    try {
      const db = await getDatabase();
      let pos: { lat: number; lon: number } | null = null;
      if (anvand) {
        if (!(await fragaOmPlats())) {
          setPosFel("Skade har inte tillgång till platstjänster. Du kan slå på det i Inställningar på telefonen.");
          return;
        }
        pos = await hamtaPosition();
        if (!pos) {
          setPosFel("Kunde inte hämta din position just nu. Försök igen.");
          return;
        }
      }
      await settJaktmarkPosition(db, mark.id, pos);
      setMark(await hamtaJaktmark(db, mark.id));
    } finally {
      setHamtarPos(false);
    }
  };

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

        <View>
          <Etikett>POSITION FÖR VÄDRET</Etikett>
          <Kort>
            <Txt variant="body">
              {mark.lat !== null && mark.lon !== null
                ? `Ungefär ${mark.lat.toFixed(2)}, ${mark.lon.toFixed(2)}`
                : "Ingen position än"}
            </Txt>
            <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
              Används för att hämta vädret från SMHI till varje drev. Sätts automatiskt första gången
              du startar en jaktdag här, avrundad till ungefär en kilometer. Stå på marken när du
              uppdaterar den.
            </Txt>
            <View style={styles.posKnappar}>
              <Knapp
                variant="sekundar"
                titel={mark.lat !== null ? "Uppdatera till min position" : "Använd min position"}
                onPress={() => andraPosition(true)}
                laddar={hamtarPos}
              />
              {mark.lat !== null && (
                <Knapp variant="text" titel="Ta bort position" onPress={() => andraPosition(false)} disabled={hamtarPos} />
              )}
              {posFel && <InlineBanner text={posFel} typ="error" />}
            </View>
          </Kort>
        </View>

        <KartdataKort
          mark={mark}
          onAndrad={async () => {
            const db = await getDatabase();
            setMark(await hamtaJaktmark(db, mark.id));
          }}
        />
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  topp: { gap: avstand.s4 },
  hjalp: { marginTop: avstand.s2 },
  posKnappar: { marginTop: avstand.s4, gap: avstand.s2 },
});
