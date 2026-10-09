import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import type { ReactNode, Ref } from "react";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck, typ } from "@/theme/tokens";
import { Ikon } from "./Ikon";
import type { IkonNamn } from "./Ikon";
import { Txt } from "./Txt";

/**
 * Mindre byggstenar från Design Systemet: skärmram, rubrikrad, etikett,
 * segmentväxlare, val-chips, varnings-chip, Tillbaka-knapp, textfält och
 * felrad.
 */

/** Skärmram: surface100, säkra marginaler, sidmarginal space-4, scroll. */
export function Skarm({
  children,
  scroll = true,
  luftUnder = avstand.s7,
  style,
  sidfot,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Extra luft längst ned (t.ex. över flikfältet). */
  luftUnder?: number;
  style?: StyleProp<ViewStyle>;
  /** Fast yta längst ned, utanför scrollen (t.ex. Spara). */
  sidfot?: ReactNode;
}) {
  const { farger } = useTema();
  const insets = useSafeAreaInsets();
  const innehall = [
    styles.innehall,
    { paddingTop: insets.top + avstand.s5, paddingBottom: sidfot ? avstand.s4 : luftUnder },
    style,
  ];
  return (
    <View style={[styles.fyll, { backgroundColor: farger.surface100 }]}>
      {scroll ? (
        <ScrollView
          style={styles.fyll}
          contentContainerStyle={innehall}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fyll, ...innehall]}>{children}</View>
      )}
      {sidfot && (
        <View
          style={[
            styles.sidfot,
            {
              backgroundColor: farger.surface200,
              borderTopColor: farger.border,
              paddingBottom: Math.max(insets.bottom, avstand.s4) + avstand.s2,
            },
          ]}
        >
          {sidfot}
        </View>
      )}
    </View>
  );
}

/** Skärmrubrik (title1) med valfri handling till höger. */
export function Rubrikrad({
  titel,
  handling,
  undertitel,
}: {
  titel: string;
  handling?: ReactNode;
  undertitel?: string;
}) {
  return (
    <View style={styles.rubrikrad}>
      <View style={styles.flex1}>
        <Txt variant="title1" accessibilityRole="header">
          {titel}
        </Txt>
        {!!undertitel && (
          <Txt variant="body" farg="inkMuted" style={styles.underrubrik}>
            {undertitel}
          </Txt>
        )}
      </View>
      {handling}
    </View>
  );
}

/** Små versaler över ett kort eller en sektion. Skriv texten i versaler. */
export function Etikett({
  children,
  farg = "inkMuted",
}: {
  children: string;
  farg?: "inkMuted" | "brand";
}) {
  return (
    <Txt variant="label" farg={farg} style={styles.etikett}>
      {children}
    </Txt>
  );
}

/** Sektion: etikett + innehåll med rätt avstånd. */
export function Sektion({ etikett, children }: { etikett?: string; children: ReactNode }) {
  return (
    <View>
      {etikett && <Etikett>{etikett}</Etikett>}
      {children}
    </View>
  );
}

/** Stor Tillbaka-knapp (tap-min) som komplement till svepgesten. */
export function TillbakaKnapp({ onPress }: { onPress?: () => void }) {
  const { farger } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tillbaka"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
      style={({ pressed }) => [
        styles.tillbaka,
        { backgroundColor: farger.surface300, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Ikon namn="tillbaka" farg={farger.ink} />
      <Txt variant="button">Tillbaka</Txt>
    </Pressable>
  );
}

/** Rund ikonknapp (t.ex. kugghjulet på Hem). */
export function IkonKnapp({
  ikon,
  etikett,
  onPress,
}: {
  ikon: IkonNamn;
  etikett: string;
  onPress: () => void;
}) {
  const { farger, kortSkugga } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etikett}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.ikonKnapp,
        { backgroundColor: farger.surface200, boxShadow: kortSkugga, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <Ikon namn={ikon} farg={farger.ink} />
    </Pressable>
  );
}

/** Segmentväxlare (pill), t.ex. Logg/Statistik och Tema. */
export function Segment<T extends string>({
  val,
  varde,
  onChange,
  etikett,
}: {
  val: { varde: T; titel: string }[];
  varde: T;
  onChange: (v: T) => void;
  etikett?: string;
}) {
  const { farger } = useTema();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={etikett}
      style={[styles.segment, { backgroundColor: farger.surface300 }]}
    >
      {val.map((v) => {
        const vald = v.varde === varde;
        return (
          <Pressable
            key={v.varde}
            accessibilityRole="tab"
            accessibilityState={{ selected: vald }}
            onPress={() => onChange(v.varde)}
            style={[styles.segmentVal, vald && { backgroundColor: farger.surface200 }]}
          >
            <Txt variant="button" farg={vald ? "brand" : "inkMuted"} style={styles.segmentText}>
              {v.titel}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Valbart chip (viltart, utfall, period). Vald: brandSoft + brand-kant. */
export function ValChip({
  titel,
  vald,
  onPress,
  hojd = tryck.min,
}: {
  titel: string;
  vald: boolean;
  onPress: () => void;
  hojd?: number;
}) {
  const { farger } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: vald }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          minHeight: hojd,
          backgroundColor: vald ? farger.brandSoft : farger.surface300,
          borderColor: vald ? farger.brand : "transparent",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Txt variant="bodyStrong" farg={vald ? "brand" : "ink"} style={hojd < 50 && styles.chipTextLiten}>
        {titel}
      </Txt>
    </Pressable>
  );
}

/** Varnings-chip: warn på warnSoft, alltid ikon + text. */
export function VarningsChip({ text }: { text: string }) {
  const { farger } = useTema();
  return (
    <View style={[styles.varning, { backgroundColor: farger.warnSoft }]}>
      <Ikon namn="varning" farg={farger.warn} storlek={14} linje={2} />
      <Txt variant="caption" farg="warn" style={styles.varningText}>
        {text}
      </Txt>
    </View>
  );
}

/** Textfält: surface300 med border-strong-kant, tap-min högt (Design Systemet). */
export function Falt({
  etikett,
  style,
  ref,
  ...rest
}: TextInputProps & { etikett?: string; ref?: Ref<TextInput> }) {
  const { farger } = useTema();
  return (
    <View style={styles.falt}>
      {etikett && <Txt variant="heading">{etikett}</Txt>}
      <TextInput
        ref={ref}
        placeholderTextColor={farger.inkMuted}
        {...rest}
        style={[
          typ.body,
          styles.input,
          { color: farger.ink, backgroundColor: farger.surface300, borderColor: farger.borderStrong },
          style,
        ]}
      />
    </View>
  );
}

/** Felmeddelande i signal-text: vad som hände och vad man gör härnäst. */
export function Felrad({ text }: { text: string | null }) {
  if (!text) {
    return null;
  }
  return (
    <Txt variant="bodyStrong" farg="signal" accessibilityLiveRegion="polite">
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  flex1: { flex: 1 },
  innehall: {
    paddingHorizontal: avstand.s4,
    gap: avstand.s5,
  },
  sidfot: {
    paddingHorizontal: avstand.s4,
    paddingTop: avstand.s3,
    borderTopWidth: 1,
  },
  rubrikrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: avstand.s3,
  },
  underrubrik: { marginTop: avstand.s2 },
  etikett: { marginBottom: avstand.s2 },
  tillbaka: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s1,
    minHeight: tryck.min,
    paddingLeft: avstand.s3,
    paddingRight: 20,
    borderRadius: radie.md,
  },
  ikonKnapp: {
    width: 48,
    height: 48,
    borderRadius: radie.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    flexDirection: "row",
    padding: avstand.s1,
    borderRadius: radie.pill,
  },
  segmentVal: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radie.pill,
  },
  segmentText: { fontSize: 16 },
  chip: {
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: radie.sm,
    borderWidth: 2,
  },
  chipTextLiten: { fontSize: 15, lineHeight: 20 },
  varning: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s1,
    paddingHorizontal: avstand.s2,
    paddingVertical: avstand.s1,
    borderRadius: radie.sm,
    marginTop: avstand.s1,
  },
  varningText: { fontFamily: typ.bodyStrong.fontFamily },
  falt: { gap: avstand.s2 },
  input: {
    minHeight: tryck.min,
    borderWidth: 1.5,
    borderRadius: radie.md,
    paddingHorizontal: avstand.s4,
  },
});
