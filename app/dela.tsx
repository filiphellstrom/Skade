import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { getDatabase } from "@/db/client";
import { hamtaDrevMedHundnamn } from "@/db/queries/drev";
import { hamtaFalltViltForDrev, hamtaFalltViltForJaktdag } from "@/db/queries/fallt";
import { hamtaHandelserForJaktdag } from "@/db/queries/handelse";
import { hamtaHund } from "@/db/queries/hund";
import { hamtaJaktdag } from "@/db/queries/jaktdag";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import { hamtaVaderForDrev, hamtaVaderForJaktdag } from "@/db/queries/vader";
import type { FalltVilt } from "@/db/types";
import { DelningsKort, KORT_BREDD, type DelningsData } from "@/components/DelningsKort";
import { Knapp } from "@/components/ui/Knapp";
import { Etikett, Felrad, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import { antalTappt } from "@/utils/drevhandelser";
import { antalDrevText, formateraVaraktighet, listaNamn } from "@/utils/format";
import { foreNamn, vaderText } from "@/utils/vader";

/**
 * Dela ett drev eller en jaktdag som bild (2026-11-04). Nås med
 * /dela?typ=drev&id=… (drevvyn) eller /dela?typ=jaktdag&id=… (jaktdagen
 * i historiken). Inget lämnar telefonen förrän man själv delar.
 *
 * Jaktmarken är dold som standard (namnet kan avslöja var man jagar).
 * Fungerar inte på webben (react-native-view-shot) - knapparna dit är
 * dolda där.
 */
export default function Dela() {
  const { farger, schema } = useTema();
  const { typ, id } = useLocalSearchParams<{ typ: "drev" | "jaktdag"; id: string }>();
  const kortRef = useRef<View>(null);
  const [data, setData] = useState<DelningsData | null>(null);
  const [visaJaktmark, setVisaJaktmark] = useState(false);
  const [visaBild, setVisaBild] = useState(true);
  const [delar, setDelar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const d = typ === "jaktdag" ? await byggJaktdag(db, id) : await byggDrev(db, id);
        if (!avbruten) setData(d);
      })();
      return () => {
        avbruten = true;
      };
    }, [typ, id]),
  );

  const dela = async () => {
    if (!kortRef.current || delar) return;
    setFel(null);
    setDelar(true);
    try {
      const uri = await captureRef(kortRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Delning stöds inte på den här enheten.");
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Dela bild" });
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Kunde inte skapa bilden.");
    } finally {
      setDelar(false);
    }
  };

  return (
    <Skarm
      sidfot={
        <View style={styles.block}>
          <Felrad text={Platform.OS === "web" ? "Delning som bild fungerar bara i appen." : fel} />
          <Knapp titel="Dela bild" ikon="dela" onPress={dela} laddar={delar} disabled={!data || Platform.OS === "web"} />
        </View>
      }
    >
      <View style={styles.topp}>
        <TillbakaKnapp />
        <Txt variant="title1" accessibilityRole="header">
          Dela som bild
        </Txt>
      </View>

      {!data ? (
        <ActivityIndicator size="large" color={farger.brand} />
      ) : (
        <View
          style={[
            styles.ram,
            { borderColor: farger.border, boxShadow: schema === "light" ? "0px 6px 20px rgba(20,32,27,0.12)" : undefined },
          ]}
        >
          <DelningsKort ref={kortRef} data={data} visaJaktmark={visaJaktmark} visaBild={visaBild} />
        </View>
      )}

      <View>
        <Etikett>PÅ BILDEN</Etikett>
        <View style={styles.chips}>
          <ValChip titel="Visa jaktmark" vald={visaJaktmark} hojd={48} onPress={() => setVisaJaktmark((v) => !v)} />
          <ValChip titel="Visa hundens bild" vald={visaBild} hojd={48} onPress={() => setVisaBild((v) => !v)} />
        </View>
        <Txt variant="caption" farg="inkMuted" style={styles.hjalp}>
          Jaktmarken är dold från början, eftersom namnet kan visa var du jagar.
        </Txt>
      </View>
    </Skarm>
  );
}

function falltRad(fallt: FalltVilt[]): string | null {
  if (fallt.length === 0) return null;
  const perArt = new Map<string, number>();
  for (const f of fallt) perArt.set(f.art, (perArt.get(f.art) ?? 0) + f.antal);
  return `Fällt: ${listaNamn([...perArt].map(([art, n]) => (n > 1 ? `${art} ×${n}` : art)))}`;
}

async function byggDrev(db: Awaited<ReturnType<typeof getDatabase>>, drevId: string): Promise<DelningsData | null> {
  const drev = await hamtaDrevMedHundnamn(db, drevId);
  if (!drev) return null;
  const [jaktdag, hund, vader, fallt, handelser] = await Promise.all([
    hamtaJaktdag(db, drev.jaktdagId),
    hamtaHund(db, drev.hundId),
    hamtaVaderForDrev(db, drevId),
    hamtaFalltViltForDrev(db, drevId),
    hamtaHandelserForJaktdag(db, drev.jaktdagId),
  ]);
  const tappt = antalTappt(handelser.filter((h) => h.drevId === drevId));
  const rader = [
    [drev.species, drev.outcome].filter(Boolean).join(" · "),
    falltRad(fallt),
    tappt > 0 ? `${tappt} tappt` : null,
  ].filter((r): r is string => !!r);
  const vaderRad = [vaderText(vader), foreNamn(jaktdag?.fore)].filter(Boolean).join(" · ");
  return {
    hundNamn: drev.hundNamn,
    hundBild: hund?.bild ?? null,
    datum: drev.startTimestamp,
    jaktmark: jaktdag?.jaktmark ?? "",
    huvudtal: formateraVaraktighet(drev.duration ?? 0),
    huvudEtikett: "DREVTID",
    rader,
    vader: vaderRad || null,
    vaderFranSmhi: !!vader,
  };
}

async function byggJaktdag(
  db: Awaited<ReturnType<typeof getDatabase>>,
  jaktdagId: string,
): Promise<DelningsData | null> {
  const [jaktdag, drev, fallt, vader] = await Promise.all([
    hamtaJaktdag(db, jaktdagId),
    hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
    hamtaFalltViltForJaktdag(db, jaktdagId),
    hamtaVaderForJaktdag(db, jaktdagId),
  ]);
  if (!jaktdag) return null;
  const avslutade = drev.filter((d) => d.endTimestamp !== null);
  const total = avslutade.reduce((s, d) => s + (d.duration ?? 0), 0);
  const hundnamn = [...new Set(avslutade.map((d) => d.hundNamn))];
  const forstaHund = avslutade[0] ? await hamtaHund(db, avslutade[0].hundId) : null;
  const temp = vader.map((v) => v.temperatur).filter((t): t is number => t !== null);
  const vaderDel =
    temp.length > 0
      ? `${Math.round(Math.min(...temp)).toString().replace("-", "−")} till ${Math.round(Math.max(...temp))
          .toString()
          .replace("-", "−")}°`
      : null;
  const vaderRad = [vaderDel, foreNamn(jaktdag.fore)].filter(Boolean).join(" · ");
  return {
    hundNamn: listaNamn(hundnamn) || "Jaktdag",
    hundBild: hundnamn.length === 1 ? (forstaHund?.bild ?? null) : null,
    datum: jaktdag.datum,
    jaktmark: jaktdag.jaktmark,
    huvudtal: formateraVaraktighet(total),
    huvudEtikett: `TOTAL DREVTID · ${antalDrevText(avslutade.length).toUpperCase()}`,
    rader: [falltRad(fallt)].filter((r): r is string => !!r),
    vader: vaderRad || null,
    vaderFranSmhi: vader.length > 0,
    tidslinje: avslutade.map((d) => ({ start: d.startTimestamp, slut: d.endTimestamp ?? d.startTimestamp })),
  };
}

const styles = StyleSheet.create({
  topp: { gap: avstand.s4 },
  block: { gap: avstand.s2 },
  ram: {
    alignSelf: "center",
    width: KORT_BREDD + 2,
    borderWidth: 1,
    borderRadius: radie.sm,
    overflow: "hidden",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  hjalp: { marginTop: avstand.s2 },
});
