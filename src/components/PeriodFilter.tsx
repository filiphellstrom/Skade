import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";
import { Stegare } from "@/components/Stegare";
import { DatumField } from "@/components/DatumField";
import type { HistorikPeriod } from "@/utils/period";

interface PeriodFilterProps {
  value: HistorikPeriod;
  onChange: (period: HistorikPeriod) => void;
}

function standardIntervallStart(): number {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function standardIntervallSlut(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Periodfilter för historiken (app/historik/index.tsx) och statistiken
 * (app/historik/statistik.tsx) - "Allt"/"Helår"/"Intervall" som chips,
 * med en år-steppare respektive två DatumField (Från/Till) som fälls ut
 * beroende på val. Varje skärm äger sitt eget filter-state lokalt (inte
 * delat mellan skärmarna) - se motivering i respektive skärms kommentar.
 */
export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const colors = useThemeColors();

  const valjTyp = (typ: HistorikPeriod["typ"]) => {
    if (typ === "allt") {
      onChange({ typ: "allt" });
    } else if (typ === "ar") {
      onChange({ typ: "ar", ar: value.typ === "ar" ? value.ar : new Date().getFullYear() });
    } else {
      onChange({
        typ: "intervall",
        start: value.typ === "intervall" ? value.start : standardIntervallStart(),
        slut: value.typ === "intervall" ? value.slut : standardIntervallSlut(),
      });
    }
  };

  return (
    <View style={styles.block}>
      <View style={styles.chipRad}>
        <TypChip label="Allt" vald={value.typ === "allt"} onPress={() => valjTyp("allt")} />
        <TypChip label="Helår" vald={value.typ === "ar"} onPress={() => valjTyp("ar")} />
        <TypChip
          label="Intervall"
          vald={value.typ === "intervall"}
          onPress={() => valjTyp("intervall")}
        />
      </View>

      {value.typ === "ar" && (
        <Stegare
          label="År"
          varde={String(value.ar)}
          onMinus={() => onChange({ typ: "ar", ar: value.ar - 1 })}
          onPlus={() => onChange({ typ: "ar", ar: value.ar + 1 })}
        />
      )}

      {value.typ === "intervall" && (
        <View style={styles.intervallBlock}>
          <View style={styles.datumFalt}>
            <Text style={[styles.datumEtikett, { color: colors.text }]}>Från</Text>
            <DatumField
              value={value.start}
              onChange={(start) => onChange({ typ: "intervall", start, slut: value.slut })}
            />
          </View>
          <View style={styles.datumFalt}>
            <Text style={[styles.datumEtikett, { color: colors.text }]}>Till</Text>
            <DatumField
              value={value.slut}
              onChange={(slut) => onChange({ typ: "intervall", start: value.start, slut })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function TypChip({
  label,
  vald,
  onPress,
}: {
  label: string;
  vald: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: vald ? colors.surfaceSelected : colors.surface,
          borderColor: vald ? colors.borderSelected : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  chipRad: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  intervallBlock: { gap: 10 },
  datumFalt: { gap: 6 },
  datumEtikett: { fontSize: 14, fontWeight: "600" },
});
