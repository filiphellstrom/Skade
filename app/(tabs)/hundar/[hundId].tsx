import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import {
  arkiveraHund,
  avarkiveraHund,
  hamtaHund,
  hamtaHundHarHistorik,
  raderaHund,
  uppdateraHund,
} from "@/db/queries/hund";
import type { Hund, UnixTimestamp } from "@/db/types";
import { BirthDateField } from "@/components/BirthDateField";
import { InlineBanner } from "@/components/InlineBanner";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Falt, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Redigera en hund - öppnas genom att trycka på hunden i huvudskärmens
 * hundlista (app/index.tsx) eller i den arkiverade listan
 * (app/hund/arkiverade.tsx). Sparar direkt (samma sparflöde som resten av
 * appen) via "Spara ändringar", men arkivering/återställning och radering
 * sker direkt vid knapptryck - de har inget eget "utkast"-läge att spara.
 *
 * useFocusEffect (inte useEffect) laddar om hunden varje gång skärmen får
 * fokus - samma mönster/anledning som bugfixen 2026-08-23 för
 * huvudskärmens hundlista (annars kan man se inaktuell data om man varit
 * på skärmen tidigare i sessionen).
 *
 * Varningar/bekräftelser (beslutat 2026-08-28) visas ENDAST när
 * hamtaHundHarHistorik() hittar någon historik (drev/jaktdagar) - en hund
 * utan historik arkiveras eller raderas direkt vid knapptryck, utan extra
 * steg. Med historik krävs en andra, inline bekräftelse innan
 * arkiveraHund()/raderaHund() faktiskt körs.
 *
 * Radering är permanent och tar bort hundens historik (Drev/JaktdagHund),
 * se raderaHund(). Arkivering (arkiveraHund/avarkiveraHund, migration
 * 0002) är reversibel och rör inte historiken alls - "Återställ hund"
 * (avarkiveraHund) kräver aldrig en bekräftelse, bara "Arkivera hund"-
 * riktningen gör när hunden har historik.
 *
 * "Arkivera hund" och "Radera hund" (men inte "Återställ hund" eller
 * bekräftelsestegets knappar) renderas med BigButtons `liten`-prop -
 * halva höjden, som en medveten visuell broms (beslutat 2026-08-29) så de
 * inte trycks på lika obetänksamt som appens övriga stora knappar.
 *
 * 2026-09-08: rubriken (hundens namn) saknade paddingTop helt (0) - lades
 * till 24, samma fix och motivering som app/historik/index.tsx - satt för
 * nära skärmkanten.
 */
export default function RedigeraHund() {
  const f = useFarger();
  const { hundId } = useLocalSearchParams<{ hundId: string }>();

  const [hund, setHund] = useState<Hund | null>(null);
  const [harHistorik, setHarHistorik] = useState(false);

  const [namn, setNamn] = useState("");
  const [ras, setRas] = useState("");
  const [fodelsedatum, setFodelsedatum] = useState<UnixTimestamp | null>(null);
  const [kommentar, setKommentar] = useState("");

  const [sparar, setSparar] = useState(false);
  const [arkiverar, setArkiverar] = useState(false);
  const [raderar, setRaderar] = useState(false);
  const [visaArkiveraBekraftelse, setVisaArkiveraBekraftelse] = useState(false);
  const [visaRaderaBekraftelse, setVisaRaderaBekraftelse] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [h, historik] = await Promise.all([
          hamtaHund(db, hundId),
          hamtaHundHarHistorik(db, hundId),
        ]);
        if (avbruten) {
          return;
        }
        if (h) {
          setHund(h);
          setNamn(h.namn);
          setRas(h.ras ?? "");
          setFodelsedatum(h.fodelsedatum);
          setKommentar(h.kommentar ?? "");
        }
        setHarHistorik(historik);
        setVisaArkiveraBekraftelse(false);
        setVisaRaderaBekraftelse(false);
        setFel(null);
      })();

      return () => {
        avbruten = true;
      };
    }, [hundId]),
  );

  const kanSpara = namn.trim().length > 0;

  const tillbaka = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/hundar");
    }
  };

  const spara = async () => {
    if (!kanSpara || sparar) {
      return;
    }
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      await uppdateraHund(db, hundId, {
        namn: namn.trim(),
        ras: ras.trim() || null,
        fodelsedatum,
        kommentar: kommentar.trim() || null,
      });
      tillbaka();
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte spara ändringarna.",
      );
      setSparar(false);
    }
  };

  const vaxlaArkivering = async () => {
    if (!hund || arkiverar) {
      return;
    }
    setFel(null);
    setArkiverar(true);
    try {
      const db = await getDatabase();
      if (hund.arkiverad) {
        await avarkiveraHund(db, hundId);
      } else {
        await arkiveraHund(db, hundId);
      }
      tillbaka();
    } catch (e) {
      setFel(
        e instanceof Error ? e.message : "Kunde inte ändra arkivstatus.",
      );
      setArkiverar(false);
      setVisaArkiveraBekraftelse(false);
    }
  };

  /**
   * "Arkivera hund"-knappen: direkt om hunden saknar historik, annars
   * kräver den att den inline-bekräftelsen visas och godkänns först (se
   * headerkommentaren). "Återställ hund" (avarkivera) går alltid via
   * vaxlaArkivering() direkt utan bekräftelse - se knappen i JSX.
   */
  const tryckArkivera = () => {
    if (harHistorik) {
      setVisaArkiveraBekraftelse(true);
    } else {
      vaxlaArkivering();
    }
  };

  /** "Radera hund"-knappen: samma direkt-vs-bekräfta-uppdelning som ovan. */
  const tryckRadera = () => {
    if (harHistorik) {
      setVisaRaderaBekraftelse(true);
    } else {
      bekraftaRadering();
    }
  };

  const bekraftaRadering = async () => {
    if (raderar) {
      return;
    }
    setFel(null);
    setRaderar(true);
    try {
      const db = await getDatabase();
      await raderaHund(db, hundId);
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera hunden.");
      setRaderar(false);
      setVisaRaderaBekraftelse(false);
    }
  };

  if (!hund) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Skarm>
        <View style={styles.topp}>
          <TillbakaKnapp />
          <Txt variant="title1" accessibilityRole="header">
            {hund.namn}
          </Txt>
        </View>

        {hund.arkiverad === 1 && <InlineBanner text="Den här hunden är arkiverad." typ="info" />}

        <Falt etikett="Namn" value={namn} onChangeText={setNamn} placeholder="T.ex. Aston" autoCapitalize="words" />
        <Falt etikett="Ras" value={ras} onChangeText={setRas} placeholder="T.ex. Norsk älghund" autoCapitalize="words" />
        <View style={styles.falt}>
          <Txt variant="heading">Födelsedatum</Txt>
          <BirthDateField value={fodelsedatum} onChange={setFodelsedatum} />
        </View>
        <Falt
          etikett="Kommentar"
          value={kommentar}
          onChangeText={setKommentar}
          placeholder="Valfri anteckning"
          autoCapitalize="sentences"
          multiline
          style={styles.inputMultiline}
        />

        {fel && <InlineBanner text={fel} typ="error" />}

        <Knapp titel="Spara ändringar" onPress={spara} disabled={!kanSpara} laddar={sparar} />

        <View style={styles.knappblock}>
          {hund.arkiverad ? (
            <Knapp titel="Återställ hund" variant="sekundar" onPress={vaxlaArkivering} laddar={arkiverar} />
          ) : !visaArkiveraBekraftelse ? (
            <View style={styles.smaKnappar}>
              <Knapp titel="Arkivera hund" variant="faraLiten" onPress={tryckArkivera} laddar={arkiverar} />
              {!visaRaderaBekraftelse && (
                <Knapp titel="Radera hund" variant="faraLiten" onPress={tryckRadera} laddar={raderar} />
              )}
            </View>
          ) : (
            <View style={styles.knappblock}>
              <InlineBanner
                text={`${hund.namn} har sparad historik (drev och/eller jaktdagar). Hunden döljs från listorna och går inte att välja för en ny jaktdag, men historiken finns kvar och du kan återställa hunden när du vill.`}
                typ="info"
              />
              <Knapp titel="Ja, arkivera" variant="sekundar" onPress={vaxlaArkivering} laddar={arkiverar} />
              <Knapp
                titel="Avbryt"
                variant="sekundar"
                onPress={() => setVisaArkiveraBekraftelse(false)}
                disabled={arkiverar}
              />
            </View>
          )}

          {hund.arkiverad === 1 && !visaRaderaBekraftelse && (
            <Knapp titel="Radera hund" variant="faraLiten" onPress={tryckRadera} laddar={raderar} />
          )}

          {visaRaderaBekraftelse && (
            <View style={styles.knappblock}>
              <InlineBanner
                text={`${hund.namn} har sparad historik (drev och/eller jaktdagar). Raderar du hunden tas den historiken bort permanent - det går inte att ångra.`}
                typ="error"
              />
              <Knapp titel="Ja, radera permanent" variant="fara" onPress={bekraftaRadering} laddar={raderar} />
              <Knapp
                titel="Avbryt"
                variant="sekundar"
                onPress={() => setVisaRaderaBekraftelse(false)}
                disabled={raderar}
              />
            </View>
          )}
        </View>
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  topp: { gap: avstand.s4 },
  falt: { gap: avstand.s2 },
  inputMultiline: { minHeight: 96, paddingTop: avstand.s3, textAlignVertical: "top" },
  knappblock: { gap: avstand.s3 },
  smaKnappar: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s3 },
});
