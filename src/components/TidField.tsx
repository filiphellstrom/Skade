import { StyleSheet, View } from "react-native";
import { Stegare } from "@/components/Stegare";
import type { UnixTimestamp } from "@/db/types";

interface TidFieldProps {
  label: string;
  value: UnixTimestamp;
  onChange: (value: UnixTimestamp) => void;
}

/**
 * Timme/Minut-steppare för att redigera KLOCKSLAGET på ett UnixTimestamp -
 * datumet hålls fast, bara timme/minut ändras (sekunder nollställs vid
 * varje ändring). Används för ett drevs start-/sluttid i efterhand
 * (app/jaktdag/[jaktdagId]/drev/[drevId].tsx, Sprint 3, Filip: "Det
 * behövs" 2026-08-29).
 *
 * Medvetet ICKE "carrying" wraparound mellan timme och minut - minut -1
 * vid :00 blir :59 UTAN att timmen räknas ner (och tvärtom med +1 vid
 * :59). Samma pragmatiska förenkling som resten av appens steppare;
 * användaren styr timme och minut var för sig. Samma delade Stegare-rad
 * som BirthDateField/DatumField/PeriodFilter.
 */
export function TidField({ label, value, onChange }: TidFieldProps) {
  const datum = new Date(value * 1000);
  const timme = datum.getHours();
  const minut = datum.getMinutes();

  const satt = (nyTimme: number, nyMinut: number) => {
    const d = new Date(value * 1000);
    d.setHours(nyTimme, nyMinut, 0, 0);
    onChange(Math.floor(d.getTime() / 1000));
  };

  const andraTimme = (delta: number) => {
    satt(((timme + delta) % 24 + 24) % 24, minut);
  };

  const andraMinut = (delta: number) => {
    satt(timme, ((minut + delta) % 60 + 60) % 60);
  };

  return (
    <View style={styles.rad}>
      <Stegare
        label={`${label} - timme`}
        varde={String(timme).padStart(2, "0")}
        onMinus={() => andraTimme(-1)}
        onPlus={() => andraTimme(1)}
      />
      <Stegare
        label={`${label} - minut`}
        varde={String(minut).padStart(2, "0")}
        onMinus={() => andraMinut(-1)}
        onPlus={() => andraMinut(1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: "row", gap: 8 },
});
