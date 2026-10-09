import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Etikett, Falt, ValChip } from "@/components/ui/Delar";
import { avstand } from "@/theme/tokens";

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
  const arFordefinierad = options.includes(value);

  const [visaAnnat, setVisaAnnat] = useState(value !== "" && !arFordefinierad);
  const [anpassadText, setAnpassadText] = useState(arFordefinierad ? "" : value);

  // Tryck på det valda chipet igen tar bort valet (tom sträng sparas som
  // NULL, se uppdateraDrev()). Samma för "Annat": andra trycket stänger
  // fältet och rensar det egna värdet.
  const valjChip = (option: string) => {
    setVisaAnnat(false);
    onChange(value === option ? "" : option);
  };

  const vaxlaAnnat = () => {
    if (visaAnnat) {
      setVisaAnnat(false);
      setAnpassadText("");
      onChange("");
    } else {
      setVisaAnnat(true);
    }
  };

  return (
    <View>
      <Etikett>{label.toUpperCase()}</Etikett>
      <View style={styles.rad}>
        {options.map((option) => (
          <ValChip key={option} titel={option} vald={value === option} onPress={() => valjChip(option)} />
        ))}
        <ValChip titel="Annat" vald={visaAnnat} onPress={vaxlaAnnat} />
      </View>

      {visaAnnat && (
        <View style={styles.annat}>
          <Falt
            value={anpassadText}
            onChangeText={setAnpassadText}
            onBlur={() => onChange(anpassadText)}
            placeholder="Skriv eget"
            autoCapitalize="sentences"
            accessibilityLabel={`${label}, eget värde`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  annat: { marginTop: avstand.s3 },
});
