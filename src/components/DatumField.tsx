import { View } from "react-native";
import { Stegare } from "@/components/Stegare";
import type { UnixTimestamp } from "@/db/types";

interface DatumFieldProps {
  value: UnixTimestamp;
  onChange: (value: UnixTimestamp) => void;
}

const MANADSNAMN = [
  "jan", "feb", "mar", "apr", "maj", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function antalDagarIManad(ar: number, manadIndex: number): number {
  return new Date(ar, manadIndex + 1, 0).getDate();
}

function tillTimestamp(ar: number, manadIndex: number, dag: number): UnixTimestamp {
  const d = new Date(ar, manadIndex, dag);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Samma Dag/Månad/År-steppare som BirthDateField, men utan dess null-läge
 * ("Ange datum"/"Ta bort datum") - ett start- eller slutdatum i
 * periodfiltret (src/components/PeriodFilter.tsx) har alltid ett värde,
 * det finns inget "okänt datum"-läge att växla till/från här. Egen liten
 * kopia av kalendermatematiken (inte importerad från BirthDateField) för
 * att slippa röra en redan levererad/låst fil - bara `Stegare` delas.
 */
export function DatumField({ value, onChange }: DatumFieldProps) {
  const datum = new Date(value * 1000);
  const ar = datum.getFullYear();
  const manadIndex = datum.getMonth();
  const dag = datum.getDate();

  const andraDag = (delta: number) => {
    const maxDag = antalDagarIManad(ar, manadIndex);
    const nyDag = ((dag - 1 + delta + maxDag) % maxDag) + 1;
    onChange(tillTimestamp(ar, manadIndex, nyDag));
  };

  const andraManad = (delta: number) => {
    let nyManad = manadIndex + delta;
    let nyAr = ar;
    if (nyManad < 0) {
      nyManad = 11;
      nyAr -= 1;
    } else if (nyManad > 11) {
      nyManad = 0;
      nyAr += 1;
    }
    const nyDag = Math.min(dag, antalDagarIManad(nyAr, nyManad));
    onChange(tillTimestamp(nyAr, nyManad, nyDag));
  };

  const andraAr = (delta: number) => {
    const nyAr = ar + delta;
    const nyDag = Math.min(dag, antalDagarIManad(nyAr, manadIndex));
    onChange(tillTimestamp(nyAr, manadIndex, nyDag));
  };

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Stegare
        label="Dag"
        varde={String(dag)}
        onMinus={() => andraDag(-1)}
        onPlus={() => andraDag(1)}
      />
      <Stegare
        label="Månad"
        varde={MANADSNAMN[manadIndex]}
        onMinus={() => andraManad(-1)}
        onPlus={() => andraManad(1)}
      />
      <Stegare
        label="År"
        varde={String(ar)}
        onMinus={() => andraAr(-1)}
        onPlus={() => andraAr(1)}
      />
    </View>
  );
}
