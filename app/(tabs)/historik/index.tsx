import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getDatabase } from "@/db/client";
import {
  hamtaAvslutadeJaktdagarForProfil,
  hamtaStatistikPerHund,
} from "@/db/queries/statistik";
import { useProfil } from "@/contexts/ProfilContext";
import type { Fordelningspost, HundStatistik, JaktdagMedSummering } from "@/db/types";
import { PeriodFilter } from "@/components/PeriodFilter";
import { exporteraHistorikSomCsv } from "@/utils/export";
import { periodTillIntervall, type HistorikPeriod } from "@/utils/period";
import { antalDrevText, formateraDag, formateraVaraktighet } from "@/utils/format";
import { useFarger } from "@/theme/TemaContext";
import { avstand } from "@/theme/tokens";
import { Knapp } from "@/components/ui/Knapp";
import { Kort, Listrad } from "@/components/ui/Kort";
import { Etikett, Felrad, Segment, Skarm } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

type Vy = "logg" | "statistik";

/**
 * Historik-fliken (sprint 6). Växel överst mellan Logg och Statistik
 * (tidigare två separata skärmar), samma periodfilter för båda.
 *
 * - Logg: avslutade jaktdagar, nyast först, i ett listkort. Tryck för
 *   att öppna jaktdagen (/historik/[jaktdagId]). Periodfiltret gäller
 *   jaktdagens datum.
 * - Statistik: ett kort per hund med total drevtid, antal drev och
 *   fördelning på viltart och utfall som staplar i frost (Design
 *   Systemet: statistik ritas i frost, fler serier i olika ljushet, aldrig
 *   ny nyans). Periodfiltret gäller drevens starttid.
 *
 * "Exportera till CSV" finns kvar här som genväg (exporterar ALL historik,
 * oberoende av periodfiltret) - huvudplatsen är Inställningar.
 */
export default function Historik() {
  const f = useFarger();
  const { profil } = useProfil();

  const [vy, setVy] = useState<Vy>("logg");
  const [period, setPeriod] = useState<HistorikPeriod>({ typ: "allt" });
  const [jaktdagar, setJaktdagar] = useState<JaktdagMedSummering[] | null>(null);
  const [statistik, setStatistik] = useState<HundStatistik[] | null>(null);
  const [exporterar, setExporterar] = useState(false);
  const [exportFel, setExportFel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let avbruten = false;
      (async () => {
        const db = await getDatabase();
        const intervall = periodTillIntervall(period) ?? undefined;
        const [j, s] = await Promise.all([
          hamtaAvslutadeJaktdagarForProfil(db, profil.id, intervall),
          hamtaStatistikPerHund(db, profil.id, intervall),
        ]);
        if (!avbruten) {
          setJaktdagar(j);
          setStatistik(s);
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
      setExportFel(e instanceof Error ? e.message : "Kunde inte exportera historiken. Försök igen.");
    } finally {
      setExporterar(false);
    }
  };

  const laddar = jaktdagar === null || statistik === null;

  return (
    <Skarm>
      <Txt variant="title1" accessibilityRole="header">
        Historik
      </Txt>

      <Segment<Vy>
        etikett="Visa"
        varde={vy}
        onChange={setVy}
        val={[
          { varde: "logg", titel: "Logg" },
          { varde: "statistik", titel: "Statistik" },
        ]}
      />

      <View style={styles.filter}>
        <PeriodFilter value={period} onChange={setPeriod} />
        {vy === "logg" && (
          <View style={styles.export}>
            <Knapp
              variant="text"
              ikon="dela"
              titel="Exportera till CSV"
              onPress={exportera}
              laddar={exporterar}
            />
            <Felrad text={exportFel} />
          </View>
        )}
      </View>

      {laddar ? (
        <ActivityIndicator size="large" color={f.brand} style={styles.laddar} />
      ) : vy === "logg" ? (
        jaktdagar.length === 0 ? (
          <Kort>
            <Txt variant="body" farg="inkMuted">
              Inga avslutade jaktdagar i den valda perioden.
            </Txt>
          </Kort>
        ) : (
          <Kort lista>
            {jaktdagar.map((j, i) => (
              <Listrad
                key={j.id}
                forsta={i === 0}
                titel={j.jaktmark}
                undertitel={`${formateraDag(j.datum)} · ${antalDrevText(j.antalDrev)}`}
                hoger={formateraVaraktighet(j.totalDrevtid)}
                onPress={() => router.push(`/historik/${j.id}`)}
              />
            ))}
          </Kort>
        )
      ) : statistik.length === 0 ? (
        <Kort>
          <Txt variant="body" farg="inkMuted">
            Ingen statistik i den valda perioden.
          </Txt>
        </Kort>
      ) : (
        <View style={styles.kortlista}>
          {statistik.map((h) => (
            <HundKort key={h.hundId} hund={h} />
          ))}
        </View>
      )}
    </Skarm>
  );
}

function HundKort({ hund }: { hund: HundStatistik }) {
  const maxViltart = Math.max(1, ...hund.viltartFordelning.map((p) => p.antal));
  return (
    <Kort>
      <View style={styles.hundTopp}>
        <View style={styles.flex1}>
          <Txt variant="title2">{hund.namn}</Txt>
          <Txt variant="caption" farg="inkMuted">
            {antalDrevText(hund.antalDrev)}
          </Txt>
        </View>
        <Txt variant="title1">{formateraVaraktighet(hund.totalDrevtid)}</Txt>
      </View>

      <Fordelning
        etikett="VILTART"
        poster={hund.viltartFordelning}
        andel={(p) => p.antal / maxViltart}
        varde={(p) => String(p.antal)}
      />
      <Fordelning
        etikett="UTFALL"
        poster={hund.utfallFordelning}
        andel={(p) => p.antal / Math.max(1, hund.antalDrev)}
        varde={(p) => `${Math.round((p.antal / Math.max(1, hund.antalDrev)) * 100)} %`}
      />
    </Kort>
  );
}

function Fordelning({
  etikett,
  poster,
  andel,
  varde,
}: {
  etikett: string;
  poster: Fordelningspost[];
  andel: (p: Fordelningspost) => number;
  varde: (p: Fordelningspost) => string;
}) {
  const f = useFarger();
  if (poster.length === 0) {
    return null;
  }
  return (
    <View style={styles.fordelning}>
      <Etikett>{etikett}</Etikett>
      <View style={styles.staplar}>
        {poster.map((p) => (
          <View
            key={p.namn}
            style={styles.stapelRad}
            accessible
            accessibilityLabel={`${p.namn}: ${varde(p)}`}
          >
            <Txt variant="caption" farg="ink" style={styles.stapelNamn} numberOfLines={1}>
              {p.namn}
            </Txt>
            <View style={[styles.spar, { backgroundColor: f.surface300 }]}>
              <View
                style={[
                  styles.stapel,
                  { backgroundColor: f.frost, width: `${Math.max(2, Math.round(andel(p) * 100))}%` },
                ]}
              />
            </View>
            <Txt variant="caption" farg="ink" style={styles.stapelVarde}>
              {varde(p)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  laddar: { paddingVertical: avstand.s5 },
  filter: { gap: avstand.s2 },
  export: { alignItems: "flex-start", gap: avstand.s1 },
  kortlista: { gap: avstand.s3 },
  hundTopp: { flexDirection: "row", alignItems: "flex-end", gap: avstand.s3 },
  fordelning: { marginTop: 20 },
  staplar: { gap: avstand.s2 },
  stapelRad: { flexDirection: "row", alignItems: "center", gap: avstand.s3 },
  stapelNamn: { width: 92, fontSize: 14, lineHeight: 20 },
  spar: { flex: 1, height: 12, borderRadius: 6, overflow: "hidden" },
  stapel: { height: 12, borderRadius: 6 },
  stapelVarde: {
    width: 44,
    textAlign: "right",
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
});
