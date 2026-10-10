import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaDrevMedHundnamn, raderaDrev, uppdateraDrev } from "@/db/queries/drev";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import type { DrevMedHundnamn, Hund } from "@/db/types";
import { ChipSelect } from "@/components/ChipSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { SelectableCard } from "@/components/SelectableCard";
import { TidVal } from "@/components/TidVal";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Felrad, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

// Ordning bestämd av Filip 2026-10-09. "Eget" (fritext i en dialog) läggs
// till av ChipSelect efter Övrigt.
const VILTARTER = ["Älg", "Vildsvin", "Rådjur", "Dovhjort", "Kronhjort", "Räv", "Hare", "Övrigt"];
const UTFALL = ["Fälld", "Missad", "Ingen kontakt"];

/**
 * Vy för ett enskilt drev - hund, start-/sluttid, viltart/utfall, samt
 * radering. Nås på två sätt:
 *
 * 1. Direkt efter att ett drev stoppats (stopp() i .../timer.tsx pushar
 *    hit med `?nystoppat=1`). Rubrik/text är då anpassad för det läget
 *    ("Drevet stoppat" + en fråga), och den sekundära knappen heter
 *    "Hoppa över".
 * 2. Från historiken (app/historik/[jaktdagId].tsx, ingen extra
 *    query-param) för att redigera eller radera ett äldre drev i
 *    efterhand (beslutat 2026-08-29, Filip: "all historik ska vara
 *    editerbar"). Då heter rubriken "Redigera drev", och den sekundära
 *    knappen heter "Avbryt" istället.
 *
 * Sprint 3 (2026-08-29, andra omgången - Filip svarade "Det behövs" på
 * frågan om hund-/tidsredigering): utökad med en Hund-sektion (bara
 * redigerbar, som en radiolista, om jaktdagen har fler än en hund kopplad
 * - annars bara hundens namn som text) och en Tid-sektion (Start-/Slut-
 * klockslag, med en live omräknad duration; sedan 2026-10-09 via TidVal
 * med rullhjul i ett ark). Spara-knappen
 * är avstängd om vald sluttid inte längre är efter starttiden.
 *
 * Båda entry-lägena delar samma Spara-logik (uppdateraDrev, lokalt state
 * tills man trycker Spara) och samma Radera-flöde (raderaDrev, samma
 * bekräftelsemönster som "Radera hund").
 *
 * 2026-09-08: ordningen på skärmen ändrad - "Hoppa över"/"Avbryt" och
 * "Radera drev" (med hela raderingsflödet, halva knapphöjden bevarad)
 * flyttade upp till direkt under rubriken/undertiteln, så de snabba
 * escape-vägarna nås utan att scrolla förbi alla fälten. "Spara" ligger
 * kvar sist, efter Hund/Tid/Viltart-sektionerna - man ska ha sett allt man
 * fyllt i innan man committar. Gäller båda lägena (nystoppat och
 * redigering). Felbannern (`fel`) flyttades samtidigt upp till direkt
 * under undertiteln så den syns oavsett om det var Spara eller Radera som
 * gick fel, utan att behöva scrolla.
 */
export default function RedigeraDrev() {
  const f = useFarger();
  const { jaktdagId, drevId, nystoppat } = useLocalSearchParams<{
    jaktdagId: string;
    drevId: string;
    nystoppat?: string;
  }>();
  const varNystoppat = nystoppat === "1";

  const [drev, setDrev] = useState<DrevMedHundnamn | null>(null);
  const [hundarPaJaktdagen, setHundarPaJaktdagen] = useState<Hund[]>([]);
  const [hundId, setHundId] = useState("");
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [endTimestamp, setEndTimestamp] = useState(0);
  const [species, setSpecies] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sparar, setSparar] = useState(false);
  const [raderar, setRaderar] = useState(false);
  const [visaRaderaBekraftelse, setVisaRaderaBekraftelse] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [d, hundar] = await Promise.all([
          hamtaDrevMedHundnamn(db, drevId),
          hamtaHundarForJaktdag(db, jaktdagId),
        ]);
        if (avbruten) {
          return;
        }
        if (d) {
          setDrev(d);
          setHundId(d.hundId);
          setStartTimestamp(d.startTimestamp);
          setEndTimestamp(d.endTimestamp ?? d.startTimestamp);
          setSpecies(d.species ?? "");
          setOutcome(d.outcome ?? "");
        }
        setHundarPaJaktdagen(hundar);
        setVisaRaderaBekraftelse(false);
        setFel(null);
      })();

      return () => {
        avbruten = true;
      };
    }, [drevId, jaktdagId]),
  );

  const tillbaka = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const duration = Math.max(0, endTimestamp - startTimestamp);
  const kanSpara = endTimestamp > startTimestamp;

  const spara = async () => {
    if (sparar || !kanSpara) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraDrev(db, drevId, {
        hundId,
        startTimestamp,
        endTimestamp,
        species,
        outcome,
      });
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara drevet.");
      setSparar(false);
    }
  };

  const avbryt = () => {
    if (sparar) {
      return;
    }
    tillbaka();
  };

  const bekraftaRadering = async () => {
    if (raderar) {
      return;
    }
    setFel(null);
    setRaderar(true);
    try {
      const db = await getDatabase();
      await raderaDrev(db, drevId);
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera drevet.");
      setRaderar(false);
      setVisaRaderaBekraftelse(false);
    }
  };

  if (!drev) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  const hundNamnNu = hundarPaJaktdagen.find((h) => h.id === hundId)?.namn ?? drev.hundNamn;

  return (
    <Skarm
      sidfot={
        <View style={styles.sidfot}>
          <Felrad text={!kanSpara ? "Sluttiden måste vara efter starttiden." : fel} />
          <Knapp titel="Spara" onPress={spara} laddar={sparar} disabled={!kanSpara} />
        </View>
      }
    >
      <View>
        <Txt variant="title1" accessibilityRole="header">
          {varNystoppat ? "Drevet stoppat" : "Redigera drev"}
        </Txt>
        <Txt variant="body" farg="inkMuted" style={styles.undertitel}>
          {hundNamnNu} · {formateraTid(duration)}
        </Txt>
      </View>

      {!visaRaderaBekraftelse ? (
        <View style={styles.toppKnappar}>
          <Knapp
            titel={varNystoppat ? "Hoppa över" : "Avbryt"}
            variant="sekundar"
            onPress={avbryt}
            disabled={sparar}
          />
          <Knapp
            titel="Radera drev"
            variant="faraLiten"
            onPress={() => setVisaRaderaBekraftelse(true)}
            laddar={raderar}
          />
        </View>
      ) : (
        <View style={styles.block}>
          <InlineBanner text="Det här drevet raderas permanent. Det går inte att ångra." typ="error" />
          <Knapp titel="Ja, radera permanent" variant="fara" onPress={bekraftaRadering} laddar={raderar} />
          <Knapp
            titel="Avbryt"
            variant="sekundar"
            onPress={() => setVisaRaderaBekraftelse(false)}
            disabled={raderar}
          />
        </View>
      )}

      {hundarPaJaktdagen.length > 1 && (
        <View>
          <Etikett>HUND</Etikett>
          <View style={styles.block}>
            {hundarPaJaktdagen.map((h) => (
              <SelectableCard
                key={h.id}
                titel={h.namn}
                vald={h.id === hundId}
                onPress={() => setHundId(h.id)}
                typ="radio"
              />
            ))}
          </View>
        </View>
      )}

      <ChipSelect
        label="Viltart"
        options={VILTARTER}
        value={species}
        onChange={setSpecies}
        egetTitel="Eget"
        egetLage="dialog"
        dialogRubrik="Eget vilt"
      />
      <ChipSelect label="Utfall" options={UTFALL} value={outcome} onChange={setOutcome} />
      <View>
        <Etikett>TID</Etikett>
        <TidVal
          start={startTimestamp}
          slut={endTimestamp}
          onStart={setStartTimestamp}
          onSlut={setEndTimestamp}
        />
      </View>
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  undertitel: { marginTop: avstand.s1 },
  // Hoppa över/Avbryt i full bredd, Radera drev mindre på raden under
  // (Filip 2026-10-10, som före designlyftet).
  toppKnappar: { gap: avstand.s3 },
  block: { gap: avstand.s2 },
  sidfot: { gap: avstand.s2 },
});
