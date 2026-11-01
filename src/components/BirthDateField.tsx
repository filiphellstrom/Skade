import { StyleSheet, View } from "react-native";
import { Knapp } from "@/components/ui/Knapp";
import { DatumRad, midnatt } from "@/components/HjulVal";
import type { UnixTimestamp } from "@/db/types";

interface BirthDateFieldProps {
  /** Unix-tid (sekunder) vid lokal midnatt, eller null = okänt/ej satt. */
  value: UnixTimestamp | null;
  onChange: (value: UnixTimestamp | null) => void;
}

function standardStartdatum(): UnixTimestamp {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  return midnatt(d);
}

/**
 * Hundens födelsedatum. Valfritt: "Ange födelsedatum" tills ett datum
 * satts, sedan en rad som öppnar Apples datumhjul (2026-11-01, ersätter
 * Dag/Månad/År-stegarna) och "Ta bort födelsedatum".
 */
export function BirthDateField({ value, onChange }: BirthDateFieldProps) {
  if (value === null) {
    return (
      <Knapp
        variant="sekundar"
        titel="Ange födelsedatum"
        onPress={() => onChange(standardStartdatum())}
      />
    );
  }
  return (
    <View style={styles.block}>
      <DatumRad titel="Född" arkTitel="Födelsedatum" varde={value} onChange={onChange} max={midnatt(new Date())} />
      <Knapp variant="text" titel="Ta bort födelsedatum" onPress={() => onChange(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
});
