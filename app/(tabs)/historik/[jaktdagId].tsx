import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag } from "@/db/queries/jaktdag";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import type { DrevMedHundnamn, Jaktdag } from "@/db/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useFarger } from "@/theme/TemaContext";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Skarm, VarningsChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { antalDrevText, formateraVaraktighet } from "@/utils/format";

/**
 * Detaljvy för en enskild (oftast avslutad) jaktdag i historiken - varje
 * drev den dagen med hund, tid, viltart och utfall. Länkad från en rad i
 * app/historik/index.tsx.
 *
 * Sprint 3 (2026-08-29): varje drev-kort är nu tryckbart och öppnar
 * app/jaktdag/[jaktdagId]/drev/[drevId].tsx för att redigera viltart/
 * utfall eller radera drevet - Filip: "all historik ska vara editerbar".
 * useFocusEffect hämtar om listan när man kommer tillbaka hit, så en
 * ändring eller radering syns direkt.
 */
export default function JaktdagHistorik() {
  const f = useFarger();
  const { jaktdagId } = useLocalSearchParams<{ jaktdagId: string }>();

  const [jaktdag, setJaktdag] = useState<Jaktdag | null>(null);
  const [drev, setDrev] = useState<DrevMedHundnamn[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const [j, d] = await Promise.all([
          hamtaJaktdag(db, jaktdagId),
          hamtaDrevMedHundnamnForJaktdag(db, jaktdagId),
        ]);
        if (!avbruten) {
          setJaktdag(j);
          setDrev(d);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [jaktdagId]),
  );

  if (!jaktdag || !drev) {
    return (
      <View style={[styles.laddar, { backgroundColor: f.surface100 }]}>
        <ActivityIndicator size="large" color={f.brand} />
      </View>
    );
  }

  const avslutade = drev.filter((d) => d.endTimestamp !== null);
  const totalDrevtid = avslutade.reduce((summa, d) => summa + (d.duration ?? 0), 0);

  return (
    <Skarm>
      <ScreenHeader jaktmark={jaktdag.jaktmark} datum={new Date(jaktdag.datum * 1000)} visaTillbaka />

      {drev.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Inga drev registrerade den här jaktdagen.
          </Txt>
        </Kort>
      ) : (
        <View>
          <Etikett>{`${antalDrevText(avslutade.length).toUpperCase()} · ${formateraVaraktighet(totalDrevtid).toUpperCase()}`}</Etikett>
          <Kort lista>
            {drev.map((d, i) => {
              const saknas = d.endTimestamp !== null && (!d.species || !d.outcome);
              return (
                <Listrad
                  key={d.id}
                  forsta={i === 0}
                  titel={d.hundNamn}
                  undertitel={
                    `${new Date(d.startTimestamp * 1000).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}` +
                    (d.species || d.outcome
                      ? ` · ${[d.species, d.outcome].filter(Boolean).join(" · ")}`
                      : "")
                  }
                  extra={saknas ? <VarningsChip text={!d.species && !d.outcome ? "Saknar viltart och utfall" : !d.species ? "Saknar viltart" : "Saknar utfall"} /> : undefined}
                  hoger={d.endTimestamp !== null ? formateraTid(d.duration ?? 0) : "Pågår"}
                  hogerFarg={d.endTimestamp !== null ? "ink" : "brand"}
                  onPress={() => router.push(`/jaktdag/${jaktdagId}/drev/${d.id}`)}
                />
              );
            })}
          </Kort>
        </View>
      )}
    </Skarm>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
});
