import { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { TextStyle } from "react-native";
import { FARGER, typ } from "@/theme/tokens";
import { filUri } from "@/utils/filer";

/**
 * Delningsbilden (2026-11-04). Ritas alltid i ljust tema, oavsett appens
 * tema, så att bilden ser likadan ut för alla som får den. Fast storlek
 * 320 x 400 punkter (4:5) - react-native-view-shot fångar den i
 * skärmens pixeltäthet (960 x 1200 px på en vanlig iPhone).
 */
export const KORT_BREDD = 320;
export const KORT_HOJD = 400;

const f = FARGER.light;
const ikon = require("../../assets/icon.png");

export interface DelningsData {
  hundNamn: string;
  hundBild: string | null;
  datum: number;
  jaktmark: string;
  /** Stora siffran, t.ex. "1 h 42 min". */
  huvudtal: string;
  huvudEtikett: string;
  /** Korta rader under siffran, t.ex. "Rådjur · Fälld". */
  rader: string[];
  /** Väder och före, t.ex. "−3° · SV 4 m/s · Spårsnö". */
  vader: string | null;
  vaderFranSmhi: boolean;
  /** Jaktdagskortet: dagens drev som staplar på en tidslinje (start/slut i unix-sekunder). */
  tidslinje?: { start: number; slut: number }[];
}

export const DelningsKort = forwardRef<
  View,
  { data: DelningsData; visaJaktmark: boolean; visaBild: boolean }
>(function DelningsKort({ data, visaJaktmark, visaBild }, ref) {
  const uri = visaBild ? filUri(data.hundBild) : null;
  const datumText = new Date(data.datum * 1000).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <View ref={ref} collapsable={false} style={styles.kort}>
      <View style={styles.topp}>
        {uri ? (
          <Image source={{ uri }} style={styles.bild} />
        ) : (
          <View style={[styles.bild, styles.initialRuta]}>
            <Text style={[t(typ.title2), { color: f.brand }]}>
              {(data.hundNamn.trim()[0] ?? "?").toLocaleUpperCase("sv-SE")}
            </Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={[t(typ.title2), { color: f.ink }]} numberOfLines={1}>
            {data.hundNamn}
          </Text>
          <Text style={[t(typ.caption), { color: f.inkMuted }]} numberOfLines={1}>
            {visaJaktmark ? `${data.jaktmark} · ${datumText}` : datumText}
          </Text>
        </View>
      </View>

      <View style={styles.mitt}>
        <Text style={[t(typ.label), { color: f.inkMuted }]}>{data.huvudEtikett}</Text>
        <Text style={[t(typ.display), { color: f.brand }]} adjustsFontSizeToFit numberOfLines={1}>
          {data.huvudtal}
        </Text>
        {data.tidslinje && data.tidslinje.length > 0 && <Tidslinje drev={data.tidslinje} />}
        {data.rader.map((r) => (
          <Text key={r} style={[t(typ.bodyStrong), { color: f.ink }]} numberOfLines={1}>
            {r}
          </Text>
        ))}
        {data.vader && (
          <Text style={[t(typ.caption), { color: f.inkMuted }]} numberOfLines={1}>
            {data.vader}
          </Text>
        )}
      </View>

      <View style={[styles.sidfot, { borderTopColor: f.border }]}>
        <Image source={ikon} style={styles.logga} />
        <Text style={[t(typ.caption), styles.flex, { color: f.ink }]}>Loggat med Skade</Text>
        {data.vader && data.vaderFranSmhi && (
          <Text style={[t(typ.caption), { color: f.inkMuted }]}>Väder: SMHI</Text>
        )}
      </View>
    </View>
  );
});

function Tidslinje({ drev }: { drev: { start: number; slut: number }[] }) {
  const fran = Math.min(...drev.map((d) => d.start));
  const till = Math.max(...drev.map((d) => d.slut));
  const span = Math.max(1, till - fran);
  const kl = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={styles.tidslinjeBlock}>
      <View style={[styles.spar, { backgroundColor: f.surface300 }]}>
        {drev.map((d) => (
          <View
            key={`${d.start}`}
            style={[
              styles.stapel,
              {
                backgroundColor: f.frost,
                left: `${((d.start - fran) / span) * 100}%`,
                width: `${Math.max(1.5, ((d.slut - d.start) / span) * 100)}%`,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.tidRad}>
        <Text style={[t(typ.caption), { color: f.inkMuted }]}>{kl(fran)}</Text>
        <Text style={[t(typ.caption), { color: f.inkMuted }]}>{kl(till)}</Text>
      </View>
    </View>
  );
}

const t = (s: TextStyle) => s;

const styles = StyleSheet.create({
  kort: {
    width: KORT_BREDD,
    height: KORT_HOJD,
    backgroundColor: f.surface100,
    padding: 24,
    justifyContent: "space-between",
  },
  topp: { flexDirection: "row", alignItems: "center", gap: 12 },
  bild: { width: 56, height: 56, borderRadius: 28, backgroundColor: f.surface300 },
  initialRuta: { alignItems: "center", justifyContent: "center", backgroundColor: f.brandSoft },
  flex: { flex: 1 },
  mitt: { gap: 4 },
  tidslinjeBlock: { marginVertical: 8, gap: 4 },
  spar: { height: 14, borderRadius: 7, overflow: "hidden" },
  stapel: { position: "absolute", top: 0, bottom: 0, borderRadius: 7 },
  tidRad: { flexDirection: "row", justifyContent: "space-between" },
  sidfot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  logga: { width: 24, height: 24, borderRadius: 6 },
});
