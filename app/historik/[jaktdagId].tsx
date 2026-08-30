import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaJaktdag } from "@/db/queries/jaktdag";
import { hamtaDrevMedHundnamnForJaktdag } from "@/db/queries/statistik";
import type { DrevMedHundnamn, Jaktdag } from "@/db/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";

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
  const colors = useThemeColors();
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
      <View style={[styles.laddar, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const totalDrevtid = drev.reduce((summa, d) => summa + (d.duration ?? 0), 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.innehall}
    >
      <ScreenHeader
        jaktmark={jaktdag.jaktmark}
        datum={new Date(jaktdag.datum * 1000)}
        visaTillbaka
      />

      {drev.length === 0 ? (
        <Text style={[styles.tomText, { color: colors.textMuted }]}>
          Inga drev registrerade den här jaktdagen.
        </Text>
      ) : (
        <>
          <Text style={[styles.summering, { color: colors.textMuted }]}>
            {drev.length} drev · totalt {formateraTid(totalDrevtid)}
          </Text>

          <View style={styles.lista}>
            {drev.map((d) => (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                onPress={() => router.push(`/jaktdag/${jaktdagId}/drev/${d.id}`)}
                style={({ pressed }) => [
                  styles.kort,
                  {
                    backgroundColor: pressed ? colors.surfaceSelected : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.kortRad}>
                  <Text style={[styles.hundNamn, { color: colors.text }]}>
                    {d.hundNamn}
                  </Text>
                  <View style={styles.tidRad}>
                    <Text style={[styles.tid, { color: colors.primary }]}>
                      {d.endTimestamp !== null
                        ? formateraTid(d.duration ?? 0)
                        : "Pågår"}
                    </Text>
                    <Text style={[styles.pil, { color: colors.textMuted }]}>›</Text>
                  </View>
                </View>
                <Text style={[styles.detaljer, { color: colors.textMuted }]}>
                  {d.species ?? "Viltart ej angiven"}
                  {" · "}
                  {d.outcome ?? "Utfall ej angivet"}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  laddar: { flex: 1, justifyContent: "center", alignItems: "center" },
  innehall: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
  },
  tomText: { fontSize: 16, textAlign: "center", marginTop: 24 },
  summering: { fontSize: 15, fontWeight: "600" },
  lista: { gap: 10 },
  kort: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  kortRad: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tidRad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hundNamn: { fontSize: 17, fontWeight: "700" },
  tid: { fontSize: 16, fontWeight: "700" },
  pil: { fontSize: 18, fontWeight: "700" },
  detaljer: { fontSize: 14 },
});
