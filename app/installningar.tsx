import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { getDatabase } from "@/db/client";
import { useProfil } from "@/contexts/ProfilContext";
import { exporteraHistorikSomCsv } from "@/utils/export";
import { lasDiagnostik } from "@/liveActivity";
import type { LasskarmDiagnostik } from "@/liveActivity";
import { useTema } from "@/theme/TemaContext";
import type { TemaVal } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Felrad, Segment, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

const INTEGRITETSPOLICY = "https://claude.ai/code/artifact/2026c8d0-e5ac-4cbc-9478-b1d58330a827";

/**
 * Inställningar (sprint 6). Öppnas från kugghjulet på Hem, ligger utanför
 * flikarna. Hjälp (/hjalp), Tema (Ljust, Mörkt, System) och Exportera till CSV.
 * Timerns eget tema ändras på timern, inte här.
 */
export default function Installningar() {
  const { temaVal, setTemaVal } = useTema();
  const { profil } = useProfil();
  const [exporterar, setExporterar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const exportera = async () => {
    if (exporterar) {
      return;
    }
    setFel(null);
    setExporterar(true);
    try {
      const db = await getDatabase();
      await exporteraHistorikSomCsv(db, profil.id);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte exportera historiken. Försök igen.");
    } finally {
      setExporterar(false);
    }
  };

  return (
    <Skarm>
      <View style={styles.topp}>
        <TillbakaKnapp />
        <Txt variant="title1" accessibilityRole="header">
          Inställningar
        </Txt>
      </View>

      <View>
        <Etikett>HJÄLP</Etikett>
        <Kort lista>
          <Listrad
            forsta
            titel="Hjälp och instruktioner"
            undertitel="Hur appen fungerar, steg för steg"
            hojd={72}
            onPress={() => router.push("/hjalp")}
          />
        </Kort>
      </View>

      <View>
        <Etikett>TEMA</Etikett>
        <Segment<TemaVal>
          etikett="Tema"
          varde={temaVal}
          onChange={setTemaVal}
          val={[
            { varde: "ljust", titel: "Ljust" },
            { varde: "morkt", titel: "Mörkt" },
            { varde: "system", titel: "System" },
          ]}
        />
        <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
          System följer telefonens inställning. Timern har en egen ljus/mörk-knapp och påverkas inte
          av valet här när du har ändrat den.
        </Txt>
      </View>

      <View>
        <Etikett>DATA</Etikett>
        <Kort>
          <Txt variant="heading">Exportera till CSV</Txt>
          <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
            All historik, alla drev, som en fil du kan mejla till dig själv och öppna i Excel.
            Perioden du valt i Historik påverkar inte exporten.
          </Txt>
          <View style={styles.knapp}>
            <Knapp titel="Exportera och dela" ikon="dela" onPress={exportera} laddar={exporterar} />
            <Felrad text={fel} />
          </View>
        </Kort>
      </View>

      <LasskarmsDiagnostik />

      <View>
        <Etikett>OM SKADE</Etikett>
        <Kort lista>
          <Listrad forsta titel="Ditt namn" hoger={profil.namn} hogerFarg="inkMuted" hojd={56} />
          <Listrad
            titel="Integritet"
            hoger="Läs policyn"
            hogerFarg="brand"
            hojd={56}
            onPress={() => Linking.openURL(INTEGRITETSPOLICY)}
          />
          <Listrad
            titel="Version"
            hoger={Constants.expoConfig?.version ?? "okänd"}
            hogerFarg="inkMuted"
            hojd={56}
          />
        </Kort>
      </View>
    </Skarm>
  );
}

/**
 * Låsskärmsdiagnostik (sprint 7): svarar på förstudiens frågor som bara
 * kan testas på en riktig iPhone. Läser mätpunkter som Starta/Stoppa-
 * knapparna på låsskärmen och appens JS-start sparar (se
 * targets/widget/_shared/SkadeLasskarmIntents.swift). Visas bara i
 * iOS-appen. Tolkning per knapptryck:
 * - "appen var igång": samma process körde JS mer än 10 s före trycket.
 * - "ny process, JS startade": appens JS-motor startade inom 10 s runt
 *   trycket, alltså startade iOS appen för knappen (t.ex. efter bortsvepning).
 * - "ny process, bara Swift": ingen JS-start i processen - bara knappens
 *   Swift-kod kördes.
 */
function tolka(d: LasskarmDiagnostik, i: LasskarmDiagnostik["intents"][number]): string {
  const sammaProcess = d.jsStarter.filter((j) => j.pid === i.pid);
  // JS startade i samma process mer än 10 s före trycket: appen var redan igång.
  if (sammaProcess.some((j) => j.tid < i.tid - 10)) {
    return "appen var igång";
  }
  // JS startade inom 10 s runt trycket: iOS startade appen (och JS) för knappen.
  if (sammaProcess.some((j) => Math.abs(j.tid - i.tid) <= 10)) {
    return "ny process, JS startade";
  }
  return "ny process, bara Swift";
}

function LasskarmsDiagnostik() {
  const [visa, setVisa] = useState(false);
  const [data, setData] = useState<LasskarmDiagnostik | null>(null);
  if (lasDiagnostik() === null) {
    return null;
  }
  const oppna = () => {
    setData(lasDiagnostik());
    setVisa((v) => !v);
  };
  const intents = [...(data?.intents ?? [])].reverse().slice(0, 8);
  return (
    <View>
      <Etikett>LÅSSKÄRM</Etikett>
      <Kort lista>
        <Listrad
          forsta
          titel="Låsskärmsdiagnostik"
          undertitel="Mätningar från Starta/Stoppa på låsskärmen"
          hoger={visa ? "Dölj" : "Visa"}
          hogerFarg="brand"
          onPress={oppna}
        />
        {visa && data && intents.length === 0 && (
          <Listrad titel="Inga knapptryck än" undertitel="Tryck Starta eller Stoppa på låsskärmen och öppna sedan den här vyn igen." />
        )}
        {visa &&
          data &&
          intents.map((i) => (
            <Listrad
              key={`${i.tid}-${i.typ}`}
              titel={`${i.typ}: ${i.resultat}`}
              undertitel={`${new Date(i.tid * 1000).toLocaleString("sv-SE")} · ${tolka(data, i)}`}
              hoger={`${i.ms} ms`}
              hogerFarg="ink"
            />
          ))}
      </Kort>
    </View>
  );
}

const styles = StyleSheet.create({
  topp: { gap: avstand.s4 },
  hjalp: { marginTop: avstand.s2 },
  knapp: { marginTop: avstand.s4, gap: avstand.s3 },
});
