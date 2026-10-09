import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { getDatabase } from "@/db/client";
import { useProfil } from "@/contexts/ProfilContext";
import { exporteraHistorikSomCsv } from "@/utils/export";
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
 * flikarna. Tema (Ljust, Mörkt, System) och Exportera till CSV.
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

const styles = StyleSheet.create({
  topp: { gap: avstand.s4 },
  hjalp: { marginTop: avstand.s2 },
  knapp: { marginTop: avstand.s4, gap: avstand.s3 },
});
