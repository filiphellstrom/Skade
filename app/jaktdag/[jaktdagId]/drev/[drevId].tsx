import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaDrevMedHundnamn, raderaDrev, uppdateraDrev } from "@/db/queries/drev";
import { hamtaHundarForJaktdag } from "@/db/queries/hund";
import type { DrevMedHundnamn, Hund } from "@/db/types";
import { BigButton } from "@/components/BigButton";
import { ChipSelect } from "@/components/ChipSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { SelectableCard } from "@/components/SelectableCard";
import { TidField } from "@/components/TidField";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

const VILTARTER = ["Rådjur", "Vildsvin", "Räv", "Hare", "Älg"];
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
 * klockslag via TidField, med en live omräknad duration). Spara-knappen
 * är avstängd om vald sluttid inte längre är efter starttiden.
 *
 * Båda entry-lägena delar samma Spara-logik (uppdateraDrev, lokalt state
 * tills man trycker Spara) och samma Radera-flöde (raderaDrev, samma
 * bekräftelsemönster som "Radera hund").
 */
export default function RedigeraDrev() {
  const colors = useThemeColors();
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
      <View style={[styles.laddar, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.innehall}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.rubrik, { color: colors.text }]}>
        {varNystoppat ? "Drevet stoppat" : "Redigera drev"}
      </Text>
      <Text style={[styles.undertitel, { color: colors.textMuted }]}>
        {formateraTid(duration)}
        {varNystoppat ? " - vill du ange viltart och utfall?" : ""}
      </Text>

      <View style={styles.faltblock}>
        <Text style={[styles.sektionLabel, { color: colors.text }]}>Hund</Text>
        {hundarPaJaktdagen.length > 1 ? (
          <View style={styles.lista}>
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
        ) : (
          <Text style={[styles.hundNamn, { color: colors.textMuted }]}>
            {drev.hundNamn}
          </Text>
        )}
      </View>

      <View style={styles.faltblock}>
        <Text style={[styles.sektionLabel, { color: colors.text }]}>Tid</Text>
        <TidField label="Start" value={startTimestamp} onChange={setStartTimestamp} />
        <TidField label="Slut" value={endTimestamp} onChange={setEndTimestamp} />
        {!kanSpara && (
          <InlineBanner
            text="Sluttiden måste vara efter starttiden."
            typ="error"
          />
        )}
      </View>

      <View style={styles.faltblock}>
        <ChipSelect
          label="Viltart"
          options={VILTARTER}
          value={species}
          onChange={setSpecies}
        />
        <ChipSelect
          label="Utfall"
          options={UTFALL}
          value={outcome}
          onChange={setOutcome}
        />
      </View>

      {fel && <InlineBanner text={fel} typ="error" />}

      <View style={styles.knappblock}>
        <BigButton label="Spara" onPress={spara} laddar={sparar} disabled={!kanSpara} />
        <BigButton
          label={varNystoppat ? "Hoppa över" : "Avbryt"}
          variant="secondary"
          onPress={avbryt}
          disabled={sparar}
        />
      </View>

      <View style={styles.raderaBlock}>
        {!visaRaderaBekraftelse ? (
          <BigButton
            label="Radera drev"
            variant="danger"
            onPress={() => setVisaRaderaBekraftelse(true)}
            laddar={raderar}
            liten
          />
        ) : (
          <View style={styles.knappblock}>
            <InlineBanner
              text="Det här drevet raderas permanent. Det går inte att ångra."
              typ="error"
            />
            <BigButton
              label="Ja, radera permanent"
              variant="danger"
              onPress={bekraftaRadering}
              laddar={raderar}
            />
            <BigButton
              label="Avbryt"
              variant="secondary"
              onPress={() => setVisaRaderaBekraftelse(false)}
              disabled={raderar}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },
  rubrik: { fontSize: 26, fontWeight: "800" },
  undertitel: { fontSize: 15, fontWeight: "600", marginTop: -12 },
  faltblock: { gap: 12 },
  sektionLabel: { fontSize: 15, fontWeight: "600" },
  hundNamn: { fontSize: 17, fontWeight: "700" },
  lista: { gap: 10 },
  knappblock: { gap: 12, marginTop: 8 },
  raderaBlock: { marginTop: 4, gap: 12 },
});
