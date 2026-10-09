import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useFarger } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import type { Farger } from "@/theme/tokens";
import { Ikon } from "./Ikon";
import type { IkonNamn } from "./Ikon";
import { Txt } from "./Txt";

/**
 * Knapparna i Design Systemet (components/Button):
 * - primar: brand med onBrand. En per skärm.
 * - sekundar: surface300 med ink.
 * - fara: signal-fyllning med onSignal - bara för bekräftad radering.
 * - faraLiten: signal-kant och -text utan fyllning, tap-small hög. Bara
 *   Arkivera hund, Radera hund och Radera drev (medveten broms).
 * - text: textlänk i brand, ingen yta (t.ex. "Visa arkiverade hundar").
 * - start / stopp: fältläget på timern, tap-field höga, ord + ikon.
 */
export type KnappVariant =
  | "primar"
  | "sekundar"
  | "fara"
  | "faraLiten"
  | "text"
  | "start"
  | "stopp";

interface Props {
  titel: string;
  onPress: () => void;
  variant?: KnappVariant;
  ikon?: IkonNamn;
  disabled?: boolean;
  laddar?: boolean;
  /** Standard: full bredd utom för faraLiten och text. */
  fullBredd?: boolean;
  /** Mindre knapp i en rubrikrad (48 px), t.ex. "Lägg till hund". */
  kompakt?: boolean;
  /** Extra höjd, t.ex. Ny jaktdag på Hem (72 px). */
  minHojd?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

function fargerFor(variant: KnappVariant, f: Farger) {
  switch (variant) {
    case "primar":
    case "start":
      return { bg: f.brand, fg: "onBrand" as const, kant: undefined };
    case "fara":
    case "stopp":
      return { bg: f.signal, fg: "onSignal" as const, kant: undefined };
    case "faraLiten":
      return { bg: "transparent", fg: "signal" as const, kant: f.signal };
    case "text":
      return { bg: "transparent", fg: "brand" as const, kant: undefined };
    default:
      return { bg: f.surface300, fg: "ink" as const, kant: undefined };
  }
}

export function Knapp({
  titel,
  onPress,
  variant = "primar",
  ikon,
  disabled = false,
  laddar = false,
  fullBredd,
  kompakt = false,
  minHojd,
  style,
  accessibilityLabel,
}: Props) {
  const f = useFarger();
  const av = disabled || laddar;
  const falt = variant === "start" || variant === "stopp";
  const liten = variant === "faraLiten";
  const { bg, fg, kant } = fargerFor(variant, f);
  const bredd = fullBredd ?? !(liten || variant === "text" || kompakt);

  const hojd =
    minHojd ?? (falt ? tryck.falt : liten ? tryck.liten : kompakt ? 48 : tryck.min);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titel}
      accessibilityState={{ disabled: av, busy: laddar }}
      onPress={av ? undefined : onPress}
      style={({ pressed }) => [
        styles.bas,
        {
          minHeight: hojd,
          backgroundColor: av && variant !== "text" && !liten ? f.surface300 : bg,
          borderRadius: falt ? radie.lg : liten ? radie.sm : radie.md,
          paddingHorizontal: liten ? avstand.s4 : variant === "text" ? avstand.s1 : avstand.s5,
          alignSelf: bredd ? "stretch" : "flex-start",
          opacity: pressed && !av ? 0.82 : 1,
        },
        kant && { borderWidth: 1.5, borderColor: av ? f.borderStrong : kant },
        style,
      ]}
    >
      {laddar ? (
        <ActivityIndicator color={f[fg]} />
      ) : (
        <View style={styles.inre}>
          {ikon && (
            <Ikon
              namn={ikon}
              farg={av ? f.inkMuted : f[fg]}
              storlek={falt ? 28 : kompakt ? 20 : 22}
              linje={ikon === "plus" ? 2 : 1.75}
            />
          )}
          <Txt
            variant={falt ? "buttonField" : "button"}
            farg={av ? "inkMuted" : fg}
            style={[
              liten && styles.litenText,
              kompakt && styles.kompaktText,
              { textAlign: "center" },
            ]}
          >
            {titel}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bas: {
    alignItems: "center",
    justifyContent: "center",
  },
  inre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: avstand.s2,
  },
  litenText: { fontSize: 15, lineHeight: 20 },
  kompaktText: { fontSize: 16, lineHeight: 22 },
});
