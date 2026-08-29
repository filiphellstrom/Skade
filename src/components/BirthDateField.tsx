import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";
import type { UnixTimestamp } from "@/db/types";

interface BirthDateFieldProps {
  /** Unix-tid (sekunder) vid lokal midnatt, eller null = okänt/ej satt. */
  value: UnixTimestamp | null;
  onChange: (value: UnixTimestamp | null) => void;
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

function standardStartdatum(): UnixTimestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() - 3);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Datumval för en hunds födelsedatum - ett annat behov än DateField (som
 * bara täcker "idag/igår/några dagar bak" för en jaktdag). Ett
 * födelsedatum kan ligga många år tillbaka, så tre fristående steppare
 * (Dag/Månad/År) används istället för chips - samma tryckbara ‹ ›-mönster
 * som DateFields "annat datum"-läge, bara upprepat tre gånger. Ingen
 * kalender-/date-picker-bibliotek läggs till (samma avvägning som gjordes
 * för jaktdagens datum i Sprint 2).
 */
export function BirthDateField({ value, onChange }: BirthDateFieldProps) {
  const colors = useThemeColors();

  if (value === null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(standardStartdatum())}
        style={[styles.angeKnapp, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.angeText, { color: colors.text }]}>
          Ange födelsedatum
        </Text>
      </Pressable>
    );
  }

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
    <View style={styles.block}>
      <View style={styles.rad}>
        <Stegare label="Dag" varde={String(dag)} onMinus={() => andraDag(-1)} onPlus={() => andraDag(1)} />
        <Stegare label="Månad" varde={MANADSNAMN[manadIndex]} onMinus={() => andraManad(-1)} onPlus={() => andraManad(1)} />
        <Stegare label="År" varde={String(ar)} onMinus={() => andraAr(-1)} onPlus={() => andraAr(1)} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={styles.taBortKnapp}>
        <Text style={[styles.taBortText, { color: colors.textMuted }]}>
          Ta bort födelsedatum
        </Text>
      </Pressable>
    </View>
  );
}

function Stegare({
  label,
  varde,
  onMinus,
  onPlus,
}: {
  label: string;
  varde: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.stegareBlock, { borderColor: colors.border }]}>
      <Text style={[styles.stegareLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.stegareRad}>
        <Pressable accessibilityRole="button" onPress={onMinus} style={styles.stegareKnapp} hitSlop={8}>
          <Text style={[styles.stegarePil, { color: colors.text }]}>‹</Text>
        </Pressable>
        <Text style={[styles.stegareVarde, { color: colors.text }]}>{varde}</Text>
        <Pressable accessibilityRole="button" onPress={onPlus} style={styles.stegareKnapp} hitSlop={8}>
          <Text style={[styles.stegarePil, { color: colors.text }]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  angeKnapp: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  angeText: { fontSize: 16, fontWeight: "600" },
  block: { gap: 8 },
  rad: { flexDirection: "row", gap: 8 },
  stegareBlock: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  stegareLabel: { fontSize: 12, fontWeight: "600" },
  stegareRad: { flexDirection: "row", alignItems: "center" },
  stegareKnapp: { paddingHorizontal: 10, paddingVertical: 8 },
  stegarePil: { fontSize: 22, fontWeight: "700" },
  stegareVarde: { fontSize: 16, fontWeight: "700", minWidth: 36, textAlign: "center" },
  taBortKnapp: { alignSelf: "center", paddingVertical: 8 },
  taBortText: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
