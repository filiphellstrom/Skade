import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { skapaJaktdag } from "@/db/queries/jaktdag";
import {
  hamtaEllerSkapaJaktmark,
  hamtaJaktmarkerMedSummering,
  namnNyckel,
} from "@/db/queries/jaktmark";
import type { JaktmarkMedSummering, Uuid } from "@/db/types";
import { useProfil } from "@/contexts/ProfilContext";
import { avstand } from "@/theme/tokens";
import { SelectableCard } from "@/components/SelectableCard";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Falt, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { formateraDag } from "@/utils/format";

function idagVidMidnatt(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

const NY = "__ny__";

/**
 * Sida 1 i jaktdagsflödet: "Ny jaktdag". Datum är alltid idag (beslutat
 * tidigare - jaktdagar loggas när de sker).
 *
 * Sprint 6: välj bland befintliga jaktmarker (senast använda först) eller
 * skriv en ny. Ett nytt namn som redan finns (skiftlägesokänsligt, med
 * svenska regler - "älgmyren" = "Älgmyren") återanvänder den befintliga
 * marken i stället för att skapa en dubblett, se
 * hamtaEllerSkapaJaktmark() i src/db/queries/jaktmark.ts.
 */
export default function NyJaktdag() {
  const { profil } = useProfil();

  const [marker, setMarker] = useState<JaktmarkMedSummering[] | null>(null);
  const [val, setVal] = useState<Uuid | typeof NY | null>(null);
  const [nyttNamn, setNyttNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const m = await hamtaJaktmarkerMedSummering(db, profil.id);
        if (!avbruten) {
          setMarker(m);
          // Ingen mark än: gå direkt till fritextfältet.
          setVal((v) => v ?? (m.length === 0 ? NY : null));
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [profil.id]),
  );

  const matchning =
    val === NY && nyttNamn.trim() && marker
      ? marker.find((m) => namnNyckel(m.namn) === namnNyckel(nyttNamn))
      : undefined;

  const kanStarta = val !== null && (val !== NY || nyttNamn.trim().length > 0);

  const starta = async () => {
    if (!kanStarta || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const jaktmarkId =
        val === NY ? (await hamtaEllerSkapaJaktmark(db, profil.id, nyttNamn)).id : (val as Uuid);
      const jaktdag = await skapaJaktdag(db, {
        profilId: profil.id,
        datum: idagVidMidnatt(),
        jaktmarkId,
      });
      router.replace(`/jaktdag/${jaktdag.id}/valj-hund`);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte skapa jaktdagen. Försök igen.");
      setSparar(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm
        sidfot={
          <Knapp titel="Starta jaktdag" onPress={starta} disabled={!kanStarta} laddar={sparar} />
        }
      >
        <View style={styles.topp}>
          <TillbakaKnapp />
          <View>
            <Txt variant="title1" accessibilityRole="header">
              Ny jaktdag
            </Txt>
            <Txt variant="body" farg="inkMuted">
              {new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
            </Txt>
          </View>
        </View>

        <View>
          <Etikett>JAKTMARK</Etikett>
          <View style={styles.lista}>
            {marker?.map((m) => (
              <SelectableCard
                key={m.id}
                typ="radio"
                titel={m.namn}
                undertitel={m.senastDatum ? `Senast ${formateraDag(m.senastDatum)}` : "Inte använd än"}
                vald={val === m.id}
                onPress={() => setVal(m.id)}
              />
            ))}
            {!!marker?.length && (
              <SelectableCard typ="radio" titel="Ny jaktmark" vald={val === NY} onPress={() => setVal(NY)} />
            )}
          </View>

          {val === NY && (
            <View style={styles.nytt}>
              <Falt
                etikett={marker?.length ? "Namn på ny jaktmark" : "Namn på jaktmarken"}
                value={nyttNamn}
                onChangeText={setNyttNamn}
                placeholder="T.ex. Storskogen"
                autoCapitalize="sentences"
                autoFocus={!!marker?.length}
                returnKeyType="done"
                onSubmitEditing={starta}
              />
              {matchning && (
                <Txt variant="caption" farg="inkMuted">
                  {matchning.namn} finns redan och används för jaktdagen.
                </Txt>
              )}
            </View>
          )}
        </View>

        {fel && <InlineBanner text={fel} typ="error" />}
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topp: { gap: avstand.s4 },
  lista: { gap: avstand.s2 },
  nytt: { marginTop: avstand.s3, gap: avstand.s2 },
});
