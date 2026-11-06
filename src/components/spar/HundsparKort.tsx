import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaSparInfoForJaktdag, raderaSparForJaktdag } from "@/db/queries/spar";
import type { SparImportResultat, SparInfo } from "@/db/queries/spar";
import { InlineBanner } from "@/components/InlineBanner";
import { Etikett } from "@/components/ui/Delar";
import { Knapp } from "@/components/ui/Knapp";
import { Kort } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { avstand } from "@/theme/tokens";
import { antalDrevText, formateraKlockslag, formateraStracka, listaNamn } from "@/utils/format";
import { valjOchImporteraHundspar } from "@/utils/hundsparImport";

const storForsta = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Sammanfattning av en import, i klartext. */
export function importText(r: SparImportResultat): string {
  if (r.ingetPaDagen) {
    return "Filerna har inga spår från den här jaktdagens datum. Har handenheten rensats sedan dess?";
  }
  const delar: string[] = [];
  if (r.hundspar.length > 0) {
    delar.push(
      `Hundspår på ${antalDrevText(r.hundspar.length)}: ` +
        r.hundspar
          .map((h) => `${h.hundNamn} ${formateraKlockslag(h.startTimestamp)} (${formateraStracka(h.strackaMeter)})`)
          .join(", "),
    );
  } else {
    delar.push("Inga hundspår kunde kopplas till dagens drev");
  }
  if (r.forareSparad) delar.push("Ditt eget spår är sparat");
  if (r.drevUtanSpar > 0) delar.push(`${storForsta(antalDrevText(r.drevUtanSpar))} saknar halsbandsspår i filerna`);
  let text = `${delar.join(". ")}.`;
  for (const o of r.oklara) {
    text += ` Drevet ${formateraKlockslag(o.startTimestamp)} (${o.hundNamn}) fick inget spår: både ${listaNamn(o.halsband)} var ute samtidigt och inget halsband heter ${o.hundNamn}.`;
  }
  return text;
}

/**
 * Jaktdagens spår från Garmin (migration 0010) på jaktdagen i Historik:
 * import av GPX-filer från Alpha-handenheten, länk till spårkartan och
 * borttagning.
 */
export function HundsparKort({ jaktdagId, onAndrad }: { jaktdagId: string; onAndrad?: () => void }) {
  const [info, setInfo] = useState<SparInfo[]>([]);
  const [arbetar, setArbetar] = useState(false);
  const [meddelande, setMeddelande] = useState<{ text: string; typ: "error" | "info" } | null>(null);
  const [bekrafta, setBekrafta] = useState(false);

  const ladda = useCallback(async () => {
    const db = await getDatabase();
    setInfo(await hamtaSparInfoForJaktdag(db, jaktdagId));
  }, [jaktdagId]);

  useEffect(() => {
    void ladda();
  }, [ladda]);

  const hund = info.filter((s) => s.typ === "hund");
  const forare = info.some((s) => s.typ === "forare");
  const harSpar = info.length > 0;

  const importera = async () => {
    if (arbetar) return;
    setMeddelande(null);
    setArbetar(true);
    try {
      const db = await getDatabase();
      const r = await valjOchImporteraHundspar(db, jaktdagId);
      if (r) {
        setMeddelande({ text: importText(r), typ: r.ingetPaDagen ? "error" : "info" });
        await ladda();
        onAndrad?.();
      }
    } catch (e) {
      setMeddelande({ text: e instanceof Error ? e.message : "Importen misslyckades.", typ: "error" });
    } finally {
      setArbetar(false);
    }
  };

  const taBort = async () => {
    const db = await getDatabase();
    await raderaSparForJaktdag(db, jaktdagId);
    setBekrafta(false);
    setMeddelande(null);
    await ladda();
    onAndrad?.();
  };

  return (
    <View>
      <Etikett>SPÅR FRÅN GARMIN</Etikett>
      <Kort>
        <Txt variant="body">
          {harSpar
            ? [
                hund.length > 0 ? `Hundspår på ${antalDrevText(hund.length)}` : "Inga hundspår på dreven",
                forare ? "ditt spår" : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Inga spår än"}
        </Txt>
        <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
          Koppla Alpha-handenheten till datorn med USB och spara GPX-filerna i Filer: en fil per
          halsband, och Current.gpx för ditt eget spår. Välj sedan alla filer här. Spåren kopplas till
          dreven efter tid, så hunden blir rätt även om två hundar har burit samma halsband.
        </Txt>
        <View style={styles.knappar}>
          <Knapp variant="sekundar" titel="Importera GPX-filer" onPress={importera} laddar={arbetar} />
          {harSpar && (
            <Knapp
              variant="sekundar"
              ikon="karta"
              titel="Visa spåren på kartan"
              onPress={() => router.push(`/jaktdag/${jaktdagId}/spar`)}
            />
          )}
          {meddelande && <InlineBanner text={meddelande.text} typ={meddelande.typ} />}
          {harSpar && !bekrafta && (
            <Knapp variant="faraLiten" titel="Ta bort spåren" onPress={() => setBekrafta(true)} />
          )}
          {bekrafta && (
            <View style={styles.knappar}>
              <Txt variant="bodyStrong">Alla spår för jaktdagen tas bort. Dreven ligger kvar.</Txt>
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
