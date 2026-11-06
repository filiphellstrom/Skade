import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { antalKartpunkter, raderaKartdata } from "@/db/queries/kartpunkt";
import type { Jaktmark } from "@/db/types";
import { InlineBanner } from "@/components/InlineBanner";
import { Etikett } from "@/components/ui/Delar";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { avstand } from "@/theme/tokens";
import { valjOchImporteraGpx } from "@/utils/gpxImport";

/**
 * Jaktmarkens gräns och markeringar (Vind och vittring, migration 0009):
 * import från GPX, länk till kartan och borttagning.
 */
export function KartdataKort({ mark, onAndrad }: { mark: Jaktmark; onAndrad: () => void }) {
  const [antal, setAntal] = useState(0);
  const [arbetar, setArbetar] = useState(false);
  const [meddelande, setMeddelande] = useState<{ text: string; typ: "error" | "info" } | null>(null);
  const [bekrafta, setBekrafta] = useState(false);

  const ladda = useCallback(async () => {
    const db = await getDatabase();
    setAntal(await antalKartpunkter(db, mark.id));
  }, [mark.id]);

  useEffect(() => {
    void ladda();
  }, [ladda, mark.grans]);

  const harData = antal > 0 || !!mark.grans;

  const importera = async () => {
    if (arbetar) return;
    setMeddelande(null);
    setArbetar(true);
    try {
      const db = await getDatabase();
      const r = await valjOchImporteraGpx(db, mark.id);
      if (r) {
        const delar = [
          `${r.nya} ${r.nya === 1 ? "markering" : "markeringar"} importerade`,
          r.gransImporterad ? "gränsen sparad" : "ingen gräns i filen",
        ];
        if (r.redanFanns > 0) delar.push(`${r.redanFanns} fanns redan och hoppades över`);
        if (r.dubbletterIFilen > 0) delar.push(`${r.dubbletterIFilen} dubbletter i filen`);
        setMeddelande({ text: `${delar.join(", ")}.`, typ: "info" });
        await ladda();
        onAndrad();
      }
    } catch (e) {
      setMeddelande({
        text: e instanceof Error ? e.message : "Importen misslyckades.",
        typ: "error",
      });
    } finally {
      setArbetar(false);
    }
  };

  const taBort = async () => {
    const db = await getDatabase();
    await raderaKartdata(db, mark.id);
    setBekrafta(false);
    setMeddelande(null);
    await ladda();
    onAndrad();
  };

  return (
    <View>
      <Etikett>KARTA – GRÄNS OCH MARKERINGAR</Etikett>
      <Kort>
        <Txt variant="body">
          {harData
            ? `${mark.grans ? "Gräns" : "Ingen gräns"} · ${antal} ${antal === 1 ? "markering" : "markeringar"}`
            : "Inga kartdata än"}
        </Txt>
        <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
          Importera en GPX-fil, t.ex. kartexporten från WeHunt. Gränsen, pass, torn och övriga
          markeringar visas då på kartan under Vind och vittring. Koordinater och kategorier behålls
          som i filen, och redan importerade markeringar läggs inte in igen.
        </Txt>
        <View style={styles.knappar}>
          <Knapp variant="sekundar" titel="Importera GPX-fil" onPress={importera} laddar={arbetar} />
          {harData && (
            <Knapp
              variant="sekundar"
              ikon="karta"
              titel="Visa på kartan"
              onPress={() => router.navigate({ pathname: "/karta", params: { jaktmark: mark.id } })}
            />
          )}
          {meddelande && <InlineBanner text={meddelande.text} typ={meddelande.typ} />}
          {harData && !bekrafta && (
            <Knapp variant="faraLiten" titel="Ta bort kartdata" onPress={() => setBekrafta(true)} />
          )}
          {bekrafta && (
            <View style={styles.knappar}>
              <Txt variant="bodyStrong">Gränsen och alla markeringar tas bort från jaktmarken.</Txt>
              <Knapp variant="fara" titel="Ja, ta bort" onPress={taBort} />
              <Knapp variant="text" titel="Avbryt" onPress={() => setBekrafta(false)} />
            </View>
          )}
        </View>
      </Kort>
    </View>
  );
}

const styles = StyleSheet.create({
  hjalp: { marginTop: avstand.s2 },
  knappar: { marginTop: avstand.s4, gap: avstand.s2 },
});
