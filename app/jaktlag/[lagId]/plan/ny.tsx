import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaKartdata } from "@/db/queries/kartpunkt";
import type { Kartdata } from "@/db/queries/kartpunkt";
import { useProfil } from "@/contexts/ProfilContext";
import { felText, skapaPlan, useLagData } from "@/jaktlag/lager";
import { giltigtDatum, idagDatum, planDatum } from "@/jaktlag/format";
import { tillPlanJaktmark } from "@/jaktlag/planmark";
import { avstand } from "@/theme/tokens";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { InlineBanner } from "@/components/InlineBanner";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Falt, Rubrikrad, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Ny jaktplan (2026-11-15). Namn, datum och vilken jaktmark planen gäller.
 * Jaktmarkens gräns och pass kopieras in i planen så att alla i laget ser
 * dem. Planen börjar som utkast och syns bara för ansvariga tills den
 * publiceras. Uppdrag och rutter ritas sedan på kartan på webben.
 */
export default function NyPlan() {
  return <KraverKonto titel="Ny plan">{() => <Innehall />}</KraverKonto>;
}

function Innehall() {
  const { lagId } = useLocalSearchParams<{ lagId: string }>();
  const { profil } = useProfil();
  const data = useLagData(lagId);
  const [namn, setNamn] = useState("");
  const [datum, setDatum] = useState(idagDatum());
  const [marker, setMarker] = useState<Kartdata[]>([]);
  const [markId, setMarkId] = useState<string | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [arbetar, setArbetar] = useState(false);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const k = (await hamtaKartdata(db, profil.id)).filter((x) => x.grans.length > 0 || x.punkter.length > 0);
      setMarker(k);
      if (k.length === 1) setMarkId(k[0].jaktmark.id);
    })().catch(() => {});
  }, [profil.id]);

  const datumOk = giltigtDatum(datum);

  const skapa = async () => {
    if (arbetar || !datumOk) return;
    setArbetar(true);
    setFel(null);
    try {
      const mark = marker.find((m) => m.jaktmark.id === markId);
      const plan = await skapaPlan(lagId, namn.trim() || `Jakt ${planDatum(datum)}`, datum, {
        uppdrag: [],
        jaktmark: mark ? tillPlanJaktmark(mark) : null,
      });
      router.replace(
        Platform.OS === "web" ? `/jaktlag/${lagId}/plan/${plan.id}/redigera` : `/jaktlag/${lagId}/plan/${plan.id}`,
      );
    } catch (e) {
      setFel(felText(e));
      setArbetar(false);
    }
  };

  return (
    <Skarm sidfot={<Knapp titel="Skapa plan" onPress={skapa} disabled={!datumOk} laddar={arbetar} />}>
      <TillbakaKnapp />
      <Rubrikrad titel="Ny plan" undertitel={data?.lag.namn} />
      {fel && <InlineBanner text={fel} />}
      <Falt etikett="Namn" value={namn} onChangeText={setNamn} placeholder={`Jakt ${planDatum(datum)}`} maxLength={80} />
      <View style={styles.block}>
        <Falt
          etikett="Datum"
          value={datum}
          onChangeText={setDatum}
          placeholder="ÅÅÅÅ-MM-DD"
          maxLength={10}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />
        <Txt variant="caption" farg={datumOk ? "inkMuted" : "signal"}>
          {datumOk ? planDatum(datum) : "Skriv datumet som ÅÅÅÅ-MM-DD, t.ex. 2026-11-21."}
        </Txt>
      </View>
      <View style={styles.block}>
        <Etikett>JAKTMARK</Etikett>
        {marker.length === 0 ? (
          <Txt farg="inkMuted">
            Ingen jaktmark med gräns eller pass finns här. Importera en GPX-fil under Jaktmarker först om du vill ha
            med gränsen och passen i planen. Det går att lägga till i efterhand på webben.
          </Txt>
        ) : (
          <View style={styles.chips}>
            {marker.map((m) => (
              <ValChip
                key={m.jaktmark.id}
                titel={m.jaktmark.namn}
                vald={markId === m.jaktmark.id}
                onPress={() => setMarkId(markId === m.jaktmark.id ? null : m.jaktmark.id)}
                hojd={48}
              />
            ))}
          </View>
        )}
      </View>
      {Platform.OS !== "web" && (
        <InlineBanner
          typ="info"
          text="Släpplatser och rutter ritas på kartan på skade.hellstrom.fyi, helst på en dator. Planen du skapar här dyker upp där."
        />
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  block: { gap: avstand.s2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
});
