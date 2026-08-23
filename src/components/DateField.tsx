import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface DateFieldProps {
  value: Date;
  onChange: (date: Date) => void;
}

function ardagenSammaDag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function laggTillDagar(datum: Date, dagar: number): Date {
  const kopia = new Date(datum);
  kopia.setDate(kopia.getDate() + dagar);
  return kopia;
}

function idagVidMidnatt(): Date {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  return nu;
}

/**
 * Datumval helt utan tangentbord (UX-principer avsnitt 13: minimal
 * textinmatning). Två chips täcker det vanliga fallet ("Idag"/"Igår").
 * "Annat datum" öppnar en stegare med stora ‹ › -knappar istället för en
 * kalender/native date picker - undviker ett nytt native-beroende och går
 * lika snabbt att peka sig till rätt dag med handskar på.
 *
 * Framåt förbi idag går inte att välja - en jaktdag kan inte loggas i
 * framtiden.
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const colors = useThemeColors();
  const idag = idagVidMidnatt();
  const igar = laggTillDagar(idag, -1);

  const arIdag = ardagenSammaDag(value, idag);
  const arIgar = ardagenSammaDag(value, igar);
  const arAnnatDatum = !arIdag && !arIgar;

  const [visaStepper, setVisaStepper] = useState(arAnnatDatum);

  const valjIdag = () => {
    setVisaStepper(false);
    onChange(idag);
  };

  const valjIgar = () => {
    setVisaStepper(false);
    onChange(igar);
  };

  const valjAnnatDatum = () => {
    setVisaStepper(true);
    if (!arAnnatDatum) {
      onChange(laggTillDagar(idag, -2));
    }
  };

  const chipStyle = (vald: boolean) => [
    styles.chip,
    {
      backgroundColor: vald ? colors.surfaceSelected : colors.surface,
      borderColor: vald ? colors.borderSelected : colors.border,
    },
  ];

  const framatSpärrad = ardagenSammaDag(value, idag);

  return (
    <View>
      <View style={styles.rad}>
        <Pressable style={chipStyle(arIdag)} onPress={valjIdag}>
          <Text style={[styles.chipText, { color: colors.text }]}>Idag</Text>
        </Pressable>
        <Pressable style={chipStyle(arIgar)} onPress={valjIgar}>
          <Text style={[styles.chipText, { color: colors.text }]}>Igår</Text>
        </Pressable>
        <Pressable style={chipStyle(visaStepper)} onPress={valjAnnatDatum}>
          <Text style={[styles.chipText, { color: colors.text }]}>
            Annat datum
          </Text>
        </Pressable>
      </View>

      {visaStepper && (
        <View style={[styles.stepper, { borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tidigare datum"
            style={styles.stepperKnapp}
            onPress={() => onChange(laggTillDagar(value, -1))}
          >
            <Text style={[styles.stepperPil, { color: colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.stepperDatum, { color: colors.text }]}>
            {value.toLocaleDateString("sv-SE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Senare datum"
            disabled={framatSpärrad}
            style={styles.stepperKnapp}
            onPress={() => onChange(laggTillDagar(value, 1))}
          >
            <Text
              style={[
                styles.stepperPil,
                { color: framatSpärrad ? colors.disabledText : colors.text },
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
  },
  chipText: { fontSize: 16, fontWeight: "600" },
  stepper: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  stepperKnapp: { paddingHorizontal: 20, paddingVertical: 12 },
  stepperPil: { fontSize: 28, fontWeight: "700" },
  stepperDatum: { fontSize: 17, fontWeight: "600" },
});
