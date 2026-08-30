import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import { hamtaStatistikPerHund } from "@/db/queries/statistik";
import { useProfil } from "@/contexts/ProfilContext";
import type { Fordelningspost, HundStatistik } from "@/db/types";
import { BackButton } from "@/components/BackButton";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formateraTid } from "@/hooks/useElapsedTime";
import { useThemeColors } from "@/theme/colors";
import { periodTillIntervall, type HistorikPeriod } from "@/utils/period";

/**
 * Statistik per hund: total drevtid, viltart-fördelning (antal per
 * viltart) och utfall-andel (andel Fälld/Missad/Ingen kontakt/Okänt av
 * alla stoppade drev, i PROCENT - Filip bad uttryckligen om detta för
 * utfall specifikt 2026-08-29). Länkad från app/historik/index.tsx.
 *
 * Sorterad efter total drevtid (fallande) - kommer redan så från
 * hamtaStatistikPerHund(). Inkluderar arkiverade hundar med vilje -
 * arkivering döljer bara hunden från de vanliga listorna, inte
 * historiken/statistiken.
 *
 * Periodfilter (Allt/Helår/Intervall) - eget lokalt state, inte delat med
 * app/historik/index.tsx (samma resonemang som där).
 */
export default function Statistik() {
  const colors = useThemeColors();
  const { profil } = useProfil();

  const [period, setPeriod] = useState<HistorikPeriod>({ typ: "allt" });
  const [statistik, setStatistik] = useState<HundStatistik[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;

      (async () => {
        const db = await getDatabase();
        const intervall = periodTillIntervall(period) ?? undefined;
        const s = await hamtaStatistikPerHund(db, profil.id, intervall);
        if (!avbruten) {
          setStatistik(s);
        }
      })();

      return () => {
        avbruten = true;
      };
    }, [profil.id, period]),
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.backRad}>
        <BackButton />
      </View>

      <ScrollView contentContainerStyle={styles.innehall}>
        <Text style={[styles.rubrik, { color: colors.text }]}>Statistik</Text>

        <PeriodFilter value={period} onChange={setPeriod} />

        {statistik === null ? (
          <View style={styles.laddar}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : statistik.length === 0 ? (
          <Text style={[styles.tomText, { color: colors.textMuted }]}>
            Ingen statistik i den valda perioden.
          </Text>
        ) : (
          <View style={styles.lista}>
            {statistik.map((h) => (
              <HundKort key={h.hundId} hund={h} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HundKort({ hund }: { hund: HundStatistik }) {
  const colors = useThemeColors();

  return (
    <View
      style={[styles.kort, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.hundNamn, { color: colors.text }]}>{hund.namn}</Text>
      <Text style={[styles.totalDrevtid, { color: colors.primary }]}>
        {formateraTid(hund.totalDrevtid)}
        <Text style={[styles.antalDrev, { color: colors.textMuted }]}>
          {"  ·  "}
          {hund.antalDrev} drev
        </Text>
      </Text>

      <Fordelningsrad
        etikett="Viltart"
        poster={hund.viltartFordelning}
        formatBadge={(p) => `${p.namn} (${p.antal})`}
      />
      <Fordelningsrad
        etikett="Utfall"
        poster={hund.utfallFordelning}
        formatBadge={(p) =>
          `${p.namn} ${Math.round((p.antal / hund.antalDrev) * 100)}%`
        }
      />
    </View>
  );
}

function Fordelningsrad({
  etikett,
  poster,
  formatBadge,
}: {
  etikett: string;
  poster: Fordelningspost[];
  formatBadge: (post: Fordelningspost) => string;
}) {
  const colors = useThemeColors();

  if (poster.length === 0) {
    return null;
  }

  return (
    <View style={styles.fordelningBlock}>
      <Text style={[styles.fordelningEtikett, { color: colors.textMuted }]}>
        {etikett}
      </Text>
      <View style={styles.badgeRad}>
        {poster.map((post) => (
          <View
            key={post.namn}
            style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <Text style={[styles.badgeText, { color: colors.text }]}>
              {formatBadge(post)}
            </Text>
          </View>
        ))}
      </View>
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
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20,
  },
  rubrik: { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  tomText: { fontSize: 16, textAlign: "center", marginTop: 24 },
  lista: { gap: 14 },
  kort: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  hundNamn: { fontSize: 19, fontWeight: "800" },
  totalDrevtid: { fontSize: 20, fontWeight: "700" },
  antalDrev: { fontSize: 14, fontWeight: "600" },
  fordelningBlock: { gap: 6 },
  fordelningEtikett: { fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  badgeRad: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 13, fontWeight: "600" },
});
