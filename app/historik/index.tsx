import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaAvslutadeJaktdagarForProfil } from "@/db/queries/statistik";
import { useProfil } from "@/contexts/ProfilContext";
import type { JaktdagMedSummering } from "@/db/types";
import { BackButton } from "@/components/BackButton";
import { BigButton } from "@/components/BigButton";
import { InfoRow } from "@/components/InfoRow";
import { InlineBanner } from "@/components/InlineBanner";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";
import { exporteraHistorikSomCsv } from "@/utils/export";
import { periodTillIntervall, type HistorikPeriod } from "@/utils/period";

/**
 * Historik-loggen: lista över avslutade jaktdagar, nyast först. Tryck på
 * en rad öppnar app/historik/[jaktdagId].tsx för att se varje drev den
 * dagen. Länkad från huvudskärmens "Historik"-knapp.
 *
 * "Statistik"-knappen leder till app/historik/statistik.tsx (samlad
 * statistik per hund) - en syskonvy till loggen, inte ett steg i den, så
 * den ligger som en egen knapp här istället för inbakad i listan.
 *
 * Sprint 3 (2026-08-29): periodfilter (Allt/Helår/Intervall, se
 * PeriodFilter.tsx) - eget lokalt state här, inte delat med
 * statistik.tsx. En egen (icke-fokusberoende) useEffect skulle räckt för
 * filtret, men det är enklare att låta useFocusEffect ta båda: den körs
 * om både vid fokus OCH när `period` ändras, eftersom period ingår i dess
 * beroendelista.
 *
 * useFocusEffect så listan är färsk om man avslutar en ny jaktdag, eller
 * redigerar/raderar ett drev och går tillbaka hit - samma mönster som
 * resten av appen.
 *
 * Sprint 4 (2026-09-08): "Exportera till CSV"-knapp - exporterar ALL
 * historik (alla stoppade drev, oberoende av periodfiltret nedan - Filip:
 * "All historik (alla drev)"), inte bara det som just nu är filtrerat i
 * listan. Se src/utils/export.ts för själva CSV-bygget och den
 * plattformsberoende ladda ner/dela-logiken.
 *
 * Samma dag: "Statistik"-knappen döpt om till "Statistik hundar" (Filip) -
 * tydligare vad den leder till innan man trycker. rubrikens paddingTop
 * höjd 8 → 24 (matchar de andra skärmarnas headerinset, se
 * claude/sprint-4-webbversion.md) - texten satt för nära skärmkanten.
 */
export default function Historik() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  const [period, setPeriod] = useState<HistorikPeriod>({ typ: "allt" });
  const [jaktdagar, setJaktdagar] = useState<JaktdagMedSummering[] | null>(null);
  const [exporterar, setExporterar] = useState(false);
  const [exportFel, setExportFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const intervall = periodTillIntervall(period) ?? undefined;
        const j = await hamtaAvslutadeJaktdagarForProfil(db, profil.id, intervall);
        if (!avbruten) {
          setJaktdagar(j);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [profil.id, period]),
  );

  const exportera = async () => {
    if (exporterar) {
      return;
    }
    setExportFel(null);
    setExporterar(true);
    try {
      const db = await getDatabase();
      await exporteraHistorikSomCsv(db, profil.id);
    } catch (e) {
      setExportFel(
        e instanceof Error ? e.message : "Kunde inte exportera historiken.",
      );
    } finally {
      setExporterar(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.backRad}>
        <BackButton />
      </View>

      <ScrollView contentContainerStyle={styles.innehall}>
        <Text style={[styles.rubrik, { color: colors.text }]}>Historik</Text>

        <BigButton
          label="Statistik hundar"
          variant="secondary"
          onPress={() => router.push("/historik/statistik")}
        />

        <BigButton
          label="Exportera till CSV"
          variant="secondary"
          onPress={exportera}
          laddar={exporterar}
        />
        {exportFel && <InlineBanner text={exportFel} typ="error" />}

        <PeriodFilter value={period} onChange={setPeriod} />

        {jaktdagar === null ? (
          <View style={styles.laddar}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : jaktdagar.length === 0 ? (
          <Text style={[styles.tomText, { color: colors.textMuted }]}>
            Inga avslutade jaktdagar i den valda perioden.
          </Text>
        ) : (
          <View style={styles.lista}>
            {jaktdagar.map((j) => (
              <InfoRow
                key={j.id}
                titel={j.jaktmark}
                undertitel={`${new Date(j.datum * 1000).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })} · ${j.antalDrev} drev`}
                hoger={j.totalDrevtid > 0 ? formateraTid(j.totalDrevtid) : undefined}
                onPress={() => router.push(`/historik/${j.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRad: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  laddar: { paddingVertical: 24, alignItems: "center" },
  innehall: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 20,
  },
  rubrik: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  tomText: { fontSize: 16, textAlign: "center", marginTop: 24 },
  lista: { gap: 10 },
});
