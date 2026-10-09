import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Etikett, Falt, ValChip } from "@/components/ui/Delar";
import { Knapp } from "@/components/ui/Knapp";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";

interface ChipSelectProps {
  label: string;
  options: string[];
  /** Nuvarande värde. Tom sträng = inget valt. */
  value: string;
  /** Anropas direkt när en chip trycks, eller när fritext-fältet tappar fokus. */
  onChange: (value: string) => void;
  /** Namnet på fritext-chippen. Standard "Annat". */
  egetTitel?: string;
  /**
   * "falt" (standard): fritext-chippen fäller ut ett textfält under raden.
   * "dialog": fritext-chippen öppnar en ruta där man skriver värdet och
   * trycker Spara. Chippen visar sedan det egna värdet.
   */
  egetLage?: "falt" | "dialog";
  /** Rubrik i dialogen, t.ex. "Eget vilt". */
  dialogRubrik?: string;
}

/**
 * Kompakt chip-rad + valfri fritext, för snabba val med minimal
 * textinmatning (viltart/utfall efter ett stoppat drev). Ett tryck på en
 * chip väljer den, ett tryck till tar bort valet (tom sträng sparas som
 * NULL, se uppdateraDrev()). Fritext-chippen ("Annat"/"Eget") tar allt
 * som inte är ett av snabbvalen.
 */
export function ChipSelect({
  label,
  options,
  value,
  onChange,
  egetTitel = "Annat",
  egetLage = "falt",
  dialogRubrik,
}: ChipSelectProps) {
  const arFordefinierad = options.includes(value);
  const arEget = value !== "" && !arFordefinierad;

  const [visaAnnat, setVisaAnnat] = useState(arEget);
  const [anpassadText, setAnpassadText] = useState(arFordefinierad ? "" : value);
  const [dialogOppen, setDialogOppen] = useState(false);

  const valjChip = (option: string) => {
    setVisaAnnat(false);
    onChange(value === option ? "" : option);
  };

  // Fältläget: andra trycket stänger fältet och rensar det egna värdet.
  const vaxlaAnnat = () => {
    if (visaAnnat) {
      setVisaAnnat(false);
      setAnpassadText("");
      onChange("");
    } else {
      setVisaAnnat(true);
    }
  };

  // Dialogläget: valt eget värde tas bort med ett tryck, som övriga chips.
  const tryckEget = () => {
    if (arEget) {
      onChange("");
    } else {
      setDialogOppen(true);
    }
  };

  const dialog = egetLage === "dialog";
  return (
    <View>
      <Etikett>{label.toUpperCase()}</Etikett>
      <View style={styles.rad}>
        {options.map((option) => (
          <ValChip key={option} titel={option} vald={value === option} onPress={() => valjChip(option)} />
        ))}
        {dialog ? (
          <ValChip titel={arEget ? `${egetTitel}: ${value}` : egetTitel} vald={arEget} onPress={tryckEget} />
        ) : (
          <ValChip titel={egetTitel} vald={visaAnnat} onPress={vaxlaAnnat} />
        )}
      </View>

      {!dialog && visaAnnat && (
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

      {dialog && (
        <EgetDialog
          oppen={dialogOppen}
          rubrik={dialogRubrik ?? `${label}, eget`}
          etikett={label}
          onAvbryt={() => setDialogOppen(false)}
          onSpara={(text) => {
            setDialogOppen(false);
            onChange(text);
          }}
        />
      )}
    </View>
  );
}

interface EgetDialogProps {
  oppen: boolean;
  rubrik: string;
  etikett: string;
  onAvbryt: () => void;
  onSpara: (text: string) => void;
}

/** Ruta för att skriva ett eget värde. Fältet får fokus direkt. */
function EgetDialog({ oppen, rubrik, etikett, onAvbryt, onSpara }: EgetDialogProps) {
  const { farger, schema } = useTema();
  const [text, setText] = useState("");
  const rensad = text.trim();

  const spara = () => {
    if (rensad) {
      onSpara(rensad);
      setText("");
    }
  };

  return (
    <Modal visible={oppen} transparent animationType="fade" onRequestClose={onAvbryt} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.bakgrund,
          { backgroundColor: schema === "dark" ? "rgba(0,0,0,0.55)" : "rgba(20,32,27,0.35)" },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onAvbryt} accessibilityLabel="Stäng" accessibilityRole="button" />
        <View style={[styles.ruta, { backgroundColor: farger.surface200 }]} accessibilityViewIsModal>
          <Txt variant="title2" accessibilityRole="header">
            {rubrik}
          </Txt>
          <Falt
            value={text}
            onChangeText={setText}
            onSubmitEditing={spara}
            returnKeyType="done"
            placeholder="Skriv själv"
            autoCapitalize="sentences"
            autoFocus
            accessibilityLabel={`${etikett}, eget värde`}
          />
          <View style={styles.knappar}>
            <Knapp
              titel="Avbryt"
              variant="sekundar"
              fullBredd={false}
              style={styles.flex1}
              onPress={() => {
                setText("");
                onAvbryt();
              }}
            />
            <Knapp titel="Spara" fullBredd={false} style={styles.flex1} onPress={spara} disabled={!rensad} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
  annat: { marginTop: avstand.s3 },
  bakgrund: { flex: 1, justifyContent: "center", padding: avstand.s4 },
  ruta: { borderRadius: radie.lg, padding: avstand.s4, gap: avstand.s4 },
  knappar: { flexDirection: "row", gap: avstand.s3 },
  flex1: { flex: 1 },
});
