import { StyleSheet, View } from "react-native";
import { ValChip } from "@/components/ui/Delar";
import { avstand } from "@/theme/tokens";
import { Stegare } from "@/components/Stegare";
import { DatumRad } from "@/components/HjulVal";
import { Kort } from "@/components/ui/Kort";
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
 * med en år-steppare respektive Från/Till i ett listkort (Apples datumhjul, 2026-11-01) som fälls ut
 * beroende på val. Varje skärm äger sitt eget filter-state lokalt (inte
 * delat mellan skärmarna) - se motivering i respektive skärms kommentar.
 */
export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
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
        <Kort lista>
          <DatumRad
            iKort
            forsta
            titel="Från"
            varde={value.start}
            max={value.slut}
            onChange={(start) => onChange({ typ: "intervall", start, slut: value.slut })}
          />
          <DatumRad
            iKort
            forsta={false}
            titel="Till"
            varde={value.slut}
            min={value.start}
            onChange={(slut) => onChange({ typ: "intervall", start: value.start, slut })}
          />
        </Kort>
      )}
    </View>
  );
}

/**
 * Periodchip: 44 px högt enligt designens Historik/Statistik - lägre än
 * tap-min, flaggat i sprint-6-designlyft.md.
 */
function TypChip({ label, vald, onPress }: { label: string; vald: boolean; onPress: () => void }) {
  return <ValChip titel={label} vald={vald} onPress={onPress} hojd={44} />;
}

const styles = StyleSheet.create({
  block: { gap: avstand.s3 },
  chipRad: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
});
