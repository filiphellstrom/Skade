import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag } from "@/db/queries/jaktdag";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import { hamtaSparForJaktdag } from "@/db/queries/spar";
import type { DrevMedHundnamn, Jaktdag, Spar } from "@/db/types";
import { Etikett, Skarm, TillbakaKnapp, ValChip } from "@/components/ui/Delar";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Txt } from "@/components/ui/Txt";
import { SparKarta } from "@/components/spar/SparKarta";
import { byggSparLager, drevFarg } from "@/components/spar/sparLager";
import { useFarger } from "@/theme/TemaContext";
import { KART_FARGER, avstand } from "@/theme/tokens";
import { formateraDag, formateraKlockslag, formateraStracka } from "@/utils/format";

/**
 * Jaktdagens spår från Garmin (migration 0010) på en karta: hundspåret
 * för varje drev i egen färg, förarens spår streckat och halsbandet
 * utanför dreven tunt och grått. Välj ett drev för att zooma in på det.
 * Öppnas från jaktdagen i Historik och från drevvyn (?drev=<id>).
 */
export default function SparSkarm() {
  const f = useFarger();
  const { jaktdagId, drev: drevParam } = useLocalSearchParams<{ jaktdagId: string; drev?: string }>();
  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [drev, setDrev] = useState<DrevMedHundnamn[]>([]);
  const [spar, setSpar] = useState<Spar[] | null>(null);
  const [vald, setVald] = useState<string | null>(drevParam ?? null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const [j, d, s] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
          hamtaSparForJaktdag(db, jaktdagId),
        ]);
        if (!avbruten) {
          setJaktdag(j);
          setDrev(d);
          setSpar(s);
        }
      })();
      return () => {
        avbruten = true;
      };
    }, [jaktdagId]),
  );

  const drevOrdning = useMemo(() => drev.map((d) => d.id), [drev]);
  const allaLager = useMemo(() => byggSparLager(spar ?? [], drevOrdning), [spar, drevOrdning]);
  const hundspar = useMemo(() => (spar ?? []).filter((s) => s.typ === "hund"), [spar]);
  const drevMedSpar = drev.filter((d) => hundspar.some((s) => s.drevId === d.id));

  const synliga = useMemo(
    () =>
      vald === null
        ? allaLager
        : allaLager.filter((l) => l.typ === "forare" || (l.typ === "hund" && l.drevId === vald)),
    [allaLager, vald],
  );
  // Hela dagen: zooma så att allt syns. Ett drev: zooma på hundspåret.
  const fokus = useMemo(() => {
    const hund = synliga.filter((l) => l.typ === "hund");
    return (vald !== null && hund.length > 0 ? hund : synliga).flatMap((l) => l.koordinater);
  }, [synliga, vald]);

  if (!jaktdag || spar === null) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  const valtSpar = vald ? hundspar.find((s) => s.drevId === vald) : null;
  const valtDrev = vald ? drev.find((d) => d.id === vald) : null;
  const harForare = spar.some((s) => s.typ === "forare");
  const harHalsband = spar.some((s) => s.typ === "halsband");

  return (
    <Skarm>
      <View style={styles.topp}>
        <TillbakaKnapp />
      </View>
      <View>
        <Txt variant="title1" accessibilityRole="header">
          Spår
        </Txt>
        <Txt variant="body" farg="inkMuted" style={styles.undertitel}>
          {jaktdag.jaktmark} · {formateraDag(jaktdag.datum)}
        </Txt>
      </View>

      {spar.length === 0 ? (
        <Kort>
          <Txt farg="inkMuted">Inga spår importerade för den här jaktdagen.</Txt>
        </Kort>
      ) : (
        <>
          <SparKarta lager={synliga} fokus={fokus} hojd={420} />

          {drevMedSpar.length > 0 && (
            <View style={styles.chips}>
              <ValChip titel="Hela dagen" vald={vald === null} onPress={() => setVald(null)} />
              {drevMedSpar.map((d) => (
                <ValChip
                  key={d.id}
                  titel={`${formateraKlockslag(d.startTimestamp)} ${d.hundNamn}`}
                  vald={vald === d.id}
                  onPress={() => setVald(d.id)}
                />
              ))}
            </View>
          )}

          {valtSpar && valtDrev ? (
            <Kort>
              <Txt variant="heading">
                {valtDrev.hundNamn} · {formateraKlockslag(valtSpar.startTid)}–{formateraKlockslag(valtSpar.slutTid)}
              </Txt>
              <Txt farg="inkMuted" style={styles.undertitel}>
                {[
                  formateraStracka(valtSpar.strackaMeter),
                  valtSpar.maxAvstandMeter !== null
                    ? `längst bort ${formateraStracka(valtSpar.maxAvstandMeter)}`
                    : null,
                  valtSpar.halsband && valtSpar.halsband !== valtDrev.hundNamn
                    ? `halsband ${valtSpar.halsband}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
            </Kort>
          ) : (
            drevMedSpar.length > 0 && (
              <View>
                <Etikett>DREV MED SPÅR</Etikett>
                <Kort lista>
                  {drevMedSpar.map((d, i) => {
                    const s = hundspar.find((x) => x.drevId === d.id);
                    return (
                      <Listrad
                        key={d.id}
                        forsta={i === 0}
                        titel={d.hundNamn}
                        undertitel={
                          `${formateraKlockslag(s?.startTid ?? d.startTimestamp)}–${formateraKlockslag(s?.slutTid ?? d.startTimestamp)}` +
                          (s?.maxAvstandMeter != null ? ` · längst bort ${formateraStracka(s.maxAvstandMeter)}` : "")
                        }
                        extra={<View style={[styles.prick, { backgroundColor: drevFarg(d.id, drevOrdning) }]} />}
                        hoger={s ? formateraStracka(s.strackaMeter) : undefined}
                        onPress={() => setVald(d.id)}
                      />
                    );
                  })}
                </Kort>
              </View>
            )
          )}

          <View style={styles.forklaring}>
            <Rad farg={KART_FARGER.hundspar[0]} text="Hundspår under drevet (från släpp till drevslut), prick vid start" />
            {harForare && <Rad farg={KART_FARGER.forare} streckad text="Ditt spår" />}
            {harHalsband && vald === null && <Rad farg={KART_FARGER.halsband} text="Halsbandet utanför dreven" />}
          </View>
        </>
      )}
    </Skarm>
  );
}

function Rad({ farg, text, streckad = false }: { farg: string; text: string; streckad?: boolean }) {
  return (
    <View style={styles.rad}>
      <View style={[styles.linje, streckad ? { borderColor: farg, borderStyle: "dashed", borderTopWidth: 3 } : { backgroundColor: farg }]} />
      <Txt variant="caption" farg="inkMuted" style={styles.flex1}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  topp: { alignItems: "flex-start" },
  undertitel: { marginTop: avstand.s1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  prick: { width: 12, height: 12, borderRadius: 6, marginTop: avstand.s1 },
  forklaring: { gap: avstand.s2 },
  rad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  linje: { width: 28, height: 3 },
  flex1: { flex: 1 },
});
