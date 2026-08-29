import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface ChipSelectProps {
  label: string;
  options: string[];
  /** Nuvarande värde. Tom sträng = inget valt. */
  value: string;
  /** Anropas direkt när en chip trycks, eller när fritext-fältet tappar fokus. */
  onChange: (value: string) => void;
}

/**
 * Kompakt chip-rad + valfri fritext, för snabba val med minimal
 * textinmatning (t.ex. viltart/utfall efter ett stoppat drev, se
 * timer.tsx). Ett tryck på en chip sparar direkt (samma sparar-direkt-
 * princip som resten av appen), ingen separat "Spara"-knapp. "Annat"-
 * chippen fäller ut ett textfält för allt som inte är ett av
 * snabbvalen - samma progressiva-avslöjande-mönster som DateFields
 * "Annat datum" i Sprint 1.
 */
export function ChipSelect({ label, options, value, onChange }: ChipSelectProps) {
  const colors = useThemeColors();
  const arFordefinierad = options.includes(value);

  const [visaAnnat, setVisaAnnat] = useState(value !== "" && !arFordefinierad);
  const [anpassadText, setAnpassadText] = useState(
    arFordefinierad ? "" : value,
  );

  const valjChip = (option: string) => {
    setVisaAnnat(false);
    onChange(option);
  };

  const valjAnnat = () => {
    setVisaAnnat(true);
  };

  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <View style={styles.rad}>
        {options.map((option) => {
          const vald = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => valjChip(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: vald ? colors.surfaceSelected : colors.surface,
                  borderColor: vald ? colors.borderSelected : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={valjAnnat}
          style={[
            styles.chip,
            {
              backgroundColor: visaAnnat ? colors.surfaceSelected : colors.surface,
              borderColor: visaAnnat ? colors.borderSelected : colors.border,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>Annat</Text>
        </Pressable>
      </View>

      {visaAnnat && (
        <TextInput
          value={anpassadText}
          onChangeText={setAnpassadText}
          onBlur={() => onChange(anpassadText)}
          placeholder="Skriv eget..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="sentences"
          style={[
            styles.input,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  label: { fontSize: 15, fontWeight: "600" },
  rad: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
  },
  chipText: { fontSize: 15, fontWeight: "600" },
  input: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
});
