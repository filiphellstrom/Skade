import { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaDrev } from "@/db/queries/drev";
import { hamtaFalltVilt, raderaFalltVilt, skapaFalltVilt, uppdateraFalltVilt } from "@/db/queries/fallt";
import type { Alder, Kon } from "@/db/types";
import { ChipSelect } from "@/components/ChipSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { Stegare } from "@/components/Stegare";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Falt, Felrad, Skarm, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { INDIVIDRAPPORTERAS, VILTARTER } from "@/utils/vilt";

/**
 * Fällt vilt (migration 0008, 2026-11-04). `falltId` = "ny" för ett nytt,
 * annars id:t på ett befintligt. Nås:
 * - direkt efter att ett drev sparats med utfallet Fälld (drevvyn byter
 *   hit med ?drevId=…&art=…, "Hoppa över" går tillbaka),
 * - från drevvyn och jaktdagens vy i historiken ("Lägg till fällt vilt").
 *
 * Kön och ålder visas direkt för älg och kronhjort (rapporteras per
 * individ till Länsstyrelsen), annars bakom "Fler uppgifter".
 */
export default function FalltViltSkarm() {
  const f = useFarger();
  const { jaktdagId, falltId, drevId, art: artParam } = useLocalSearchParams<{
    jaktdagId: string;
    falltId: string;
    drevId?: string;
    art?: string;
  }>();
  const ny = falltId === "ny";

  const [laddat, setLaddat] = useState(false);
  const [art, setArt] = useState("");
  const [antal, setAntal] = useState(1);
  const [kon, setKon] = useState<Kon | null>(null);
  const [alder, setAlder] = useState<Alder | null>(null);
  const [skytt, setSkytt] = useState("");
  const [vikt, setVikt] = useState("");
  const [kommentar, setKommentar] = useState("");
  const [hundId, setHundId] = useState<string | null>(null);
  const [tidpunkt, setTidpunkt] = useState(Math.floor(Date.now() / 1000));
  const [visaMer, setVisaMer] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        if (ny) {
          const drev = drevId ? await hamtaDrev(db, drevId) : null;
          if (avbruten) return;
          setArt(artParam ?? "");
          setHundId(drev?.hundId ?? null);
          setTidpunkt(drev?.endTimestamp ?? Math.floor(Date.now() / 1000));
        } else {
          const v = await hamtaFalltVilt(db, falltId);
          if (avbruten || !v) return;
          setArt(v.art);
          setAntal(v.antal);
          setKon(v.kon);
          setAlder(v.alder);
          setSkytt(v.skytt ?? "");
          setVikt(v.vikt !== null ? String(v.vikt).replace(".", ",") : "");
          setKommentar(v.kommentar ?? "");
          setVisaMer(v.kon !== null || v.alder !== null || v.vikt !== null || !!v.kommentar);
        }
        setLaddat(true);
      })();
      return () => {
        avbruten = true;
      };
    }, [ny, falltId, drevId, artParam]),
  );

  const tillbaka = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const viktTal = vikt.trim() ? Number(vikt.replace(",", ".")) : null;
  const viktFel = viktTal !== null && (!Number.isFinite(viktTal) || viktTal <= 0);
  const kanSpara = art.trim().length > 0 && !viktFel;
  const individ = INDIVIDRAPPORTERAS.includes(art);

  const spara = async () => {
    if (!kanSpara || sparar) return;
    setFel(null);
    setSparar(true);
    try {
      const db = await getDatabase();
      const data = {
        art,
        antal,
        kon,
        alder,
        skytt: skytt || null,
        vikt: viktTal,
        kommentar: kommentar || null,
      };
      if (ny) {
        await skapaFalltVilt(db, { ...data, jaktdagId, drevId: drevId ?? null, hundId, tidpunkt });
      } else {
        await uppdateraFalltVilt(db, falltId, data);
      }
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte spara.");
      setSparar(false);
    }
  };

  const radera = async () => {
    setSparar(true);
    try {
      const db = await getDatabase();
      await raderaFalltVilt(db, falltId);
      tillbaka();
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte radera.");
      setSparar(false);
    }
  };

  if (!laddat) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Skarm
        sidfot={
          <View style={styles.block}>
            <Felrad text={viktFel ? "Vikten måste vara ett tal i kilo, t.ex. 14,5." : fel} />
            <Knapp titel="Spara" onPress={spara} disabled={!kanSpara} laddar={sparar} />
          </View>
        }
      >
        <View>
          <Txt variant="title1" accessibilityRole="header">
            {ny ? "Fällt vilt" : "Redigera fällt vilt"}
          </Txt>
          <Txt variant="body" farg="inkMuted" style={styles.undertitel}>
            {new Date(tidpunkt * 1000).toLocaleString("sv-SE", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Txt>
        </View>

        {!bekraftaRadera ? (
          <View style={styles.block}>
            <Knapp titel={ny && drevId ? "Hoppa över" : "Avbryt"} variant="sekundar" onPress={tillbaka} disabled={sparar} />
            {!ny && (
              <Knapp titel="Radera" variant="faraLiten" fullBredd onPress={() => setBekraftaRadera(true)} />
            )}
          </View>
        ) : (
          <View style={styles.block}>
            <InlineBanner text="Det fällda viltet raderas permanent. Det går inte att ångra." typ="error" />
            <Knapp titel="Ja, radera permanent" variant="fara" onPress={radera} laddar={sparar} />
            <Knapp titel="Avbryt" variant="sekundar" onPress={() => setBekraftaRadera(false)} disabled={sparar} />
          </View>
        )}

        <ChipSelect
          label="Viltart"
          options={VILTARTER}
          value={art}
          onChange={setArt}
          egetTitel="Eget"
          egetLage="dialog"
          dialogRubrik="Eget vilt"
        />

        <Stegare
          label="Antal"
          varde={String(antal)}
          onMinus={() => setAntal((n) => Math.max(1, n - 1))}
          onPlus={() => setAntal((n) => Math.min(99, n + 1))}
        />

        <Falt etikett="Skytt" value={skytt} onChangeText={setSkytt} placeholder="Namn, frivilligt" autoCapitalize="words" />

        {individ || visaMer ? (
          <>
            <View>
              <Etikett>KÖN</Etikett>
              <View style={styles.chips}>
                <ValChip titel="Hane" vald={kon === "hane"} onPress={() => setKon(kon === "hane" ? null : "hane")} />
                <ValChip titel="Hona" vald={kon === "hona"} onPress={() => setKon(kon === "hona" ? null : "hona")} />
              </View>
            </View>
            <View>
              <Etikett>ÅLDER</Etikett>
              <View style={styles.chips}>
                <ValChip
                  titel="Ungdjur"
                  vald={alder === "ungdjur"}
                  onPress={() => setAlder(alder === "ungdjur" ? null : "ungdjur")}
                />
                <ValChip
                  titel="Vuxen"
                  vald={alder === "vuxen"}
                  onPress={() => setAlder(alder === "vuxen" ? null : "vuxen")}
                />
              </View>
              <Txt variant="caption" farg="inkMuted" style={styles.undertitel}>
                Ungdjur = kalv, kid eller årsunge.
              </Txt>
            </View>
            <Falt
              etikett="Slaktvikt (kg)"
              value={vikt}
              onChangeText={setVikt}
              placeholder="Frivilligt"
              keyboardType="decimal-pad"
            />
            <Falt
              etikett="Kommentar"
              value={kommentar}
              onChangeText={setKommentar}
              placeholder="Frivilligt"
              multiline
              style={styles.kommentar}
              textAlignVertical="top"
            />
          </>
        ) : (
          <Knapp variant="text" titel="Fler uppgifter (kön, ålder, vikt, kommentar)" onPress={() => setVisaMer(true)} />
        )}
      </Skarm>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  undertitel: { marginTop: avstand.s1 },
  block: { gap: avstand.s3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  kommentar: { minHeight: 96, paddingTop: avstand.s3 },
});
