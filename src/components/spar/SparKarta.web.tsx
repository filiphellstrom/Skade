import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { KART_FARGER, avstand, radie } from "@/theme/tokens";
import type { SparLager } from "./sparLager";

/**
 * Webbversionen: Apple Maps finns inte på webben, så spåren ritas som
 * linjer utan kartbild (platt projektion, norr uppåt). Räcker för att se
 * formen på dreven; kartbilden finns i iPhone-appen.
 */
export function SparKarta({
  lager,
  fokus,
  hojd,
}: {
  lager: SparLager[];
  fokus: { latitude: number; longitude: number }[];
  hojd: number;
}) {
  const { farger } = useTema();
  const [bredd, setBredd] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setBredd(e.nativeEvent.layout.width);

  const alla = fokus.length >= 2 ? fokus : lager.flatMap((l) => l.koordinater);
  const lat = alla.map((k) => k.latitude);
  const lon = alla.map((k) => k.longitude);
  const minLat = Math.min(...lat);
  const maxLat = Math.max(...lat);
  const minLon = Math.min(...lon);
  const maxLon = Math.max(...lon);
  const kos = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const marg = 16;
  const skala = Math.min(
    (bredd - 2 * marg) / Math.max(1e-9, (maxLon - minLon) * kos),
    (hojd - 2 * marg) / Math.max(1e-9, maxLat - minLat),
  );
  const offX = (bredd - (maxLon - minLon) * kos * skala) / 2;
  const offY = (hojd - (maxLat - minLat) * skala) / 2;
  const xy = (k: { latitude: number; longitude: number }) =>
    `${(offX + (k.longitude - minLon) * kos * skala).toFixed(1)},${(offY + (maxLat - k.latitude) * skala).toFixed(1)}`;

  return (
    <View
      onLayout={onLayout}
      style={[styles.ram, { height: hojd, borderColor: farger.border, backgroundColor: farger.surface200 }]}
    >
      {bredd > 0 && alla.length >= 2 && (
        <Svg width={bredd} height={hojd}>
          {lager.map((l) => (
            <Polyline
              key={l.id}
              points={l.koordinater.map(xy).join(" ")}
              fill="none"
              stroke={l.farg}
              strokeWidth={l.bredd}
              strokeDasharray={l.streckad ? "6 6" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {lager
            .filter((l) => l.typ === "hund")
            .map((l) => {
              const [x, y] = xy(l.koordinater[0]).split(",").map(Number);
              return (
                <Circle key={`${l.id}-s`} cx={x} cy={y} r={6} fill={l.farg} stroke={KART_FARGER.sparKontur} strokeWidth={2} />
              );
            })}
        </Svg>
      )}
      <Txt variant="caption" farg="inkMuted" style={styles.not}>
        Kartbilden finns i iPhone-appen
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  ram: { borderRadius: radie.md, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  not: { position: "absolute", left: avstand.s3, bottom: avstand.s2 },
});
