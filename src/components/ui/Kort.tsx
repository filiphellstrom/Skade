import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { Ikon } from "./Ikon";
import { Txt } from "./Txt";

/**
 * Kort enligt Design Systemet (components/Card): surface200, radius-lg,
 * space-4 inre marginal och kortskugga (bara i ljust läge).
 *
 * - variant "pagaende": brandSoft utan skugga - pågående jaktdag på Hem.
 * - lista: inga inre marginaler, rader (<Listrad/>) direkt i kortet.
 *
 * Aldrig ett kort i ett kort, aldrig färgad kant på ena sidan.
 */
interface KortProps {
  children: ReactNode;
  variant?: "vanlig" | "pagaende";
  lista?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Kort({ children, variant = "vanlig", lista = false, style }: KortProps) {
  const { farger, kortSkugga } = useTema();
  const pagaende = variant === "pagaende";
  return (
    <View
      style={[
        styles.kort,
        {
          backgroundColor: pagaende ? farger.brandSoft : farger.surface200,
          boxShadow: pagaende ? undefined : kortSkugga,
          padding: lista ? 0 : avstand.s4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Listrad i ett listkort: minst tap-min hög, skiljelinje i `border`
 * ovanför alla rader utom den första. Rubrik i heading, stödtext i
 * caption, nyckelvärde till höger i bodyStrong.
 */
interface ListradProps {
  titel: string;
  undertitel?: string;
  /** Under undertiteln, t.ex. ett varnings-chip. */
  extra?: ReactNode;
  hoger?: string;
  hogerUnder?: string;
  hogerFarg?: "ink" | "brand" | "inkMuted";
  /** Ikon i en mjuk grön ruta till vänster (t.ex. jaktmarker). */
  ikon?: "jaktmark" | "hund";
  forsta?: boolean;
  onPress?: () => void;
  hojd?: number;
  accessibilityLabel?: string;
}

export function Listrad({
  titel,
  undertitel,
  extra,
  hoger,
  hogerUnder,
  hogerFarg = "ink",
  ikon,
  forsta = false,
  onPress,
  hojd,
  accessibilityLabel,
}: ListradProps) {
  const { farger } = useTema();
  const innehall = (
    <>
      <View style={styles.vanster}>
        {ikon && (
          <View style={[styles.ikonRuta, { backgroundColor: farger.brandSoft }]}>
            <Ikon namn={ikon} farg={farger.brand} storlek={22} />
          </View>
        )}
        <View style={styles.textkolumn}>
          <Txt variant="heading" numberOfLines={1}>
            {titel}
          </Txt>
          {!!undertitel && (
            <Txt variant="caption" farg="inkMuted" numberOfLines={2}>
              {undertitel}
            </Txt>
          )}
          {extra}
        </View>
      </View>
      {(hoger || hogerUnder || onPress) && (
        <View style={styles.hoger}>
          <View style={styles.hogerText}>
            {!!hoger && (
              <Txt variant="bodyStrong" farg={hogerFarg} style={styles.hogerJust}>
                {hoger}
              </Txt>
            )}
            {!!hogerUnder && (
              <Txt variant="caption" farg="inkMuted" style={styles.hogerJust}>
                {hogerUnder}
              </Txt>
            )}
          </View>
          {onPress && <Ikon namn="framat" farg={farger.inkMuted} storlek={20} />}
        </View>
      )}
    </>
  );

  const stil = [
    styles.rad,
    { minHeight: hojd ?? 72 },
    !forsta && { borderTopWidth: 1, borderTopColor: farger.border },
  ];

  if (!onPress) {
    return <View style={stil}>{innehall}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [titel, undertitel, hoger].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [...stil, pressed && { backgroundColor: farger.surface300 }]}
    >
      {innehall}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kort: {
    borderRadius: radie.lg,
    overflow: "hidden",
  },
  rad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: avstand.s2,
    paddingHorizontal: avstand.s4,
    gap: avstand.s3,
  },
  vanster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
  },
  ikonRuta: {
    width: 40,
    height: 40,
    borderRadius: radie.md,
    alignItems: "center",
    justifyContent: "center",
  },
  textkolumn: { flex: 1, gap: 2 },
  hoger: { flexDirection: "row", alignItems: "center", gap: avstand.s2 },
  hogerText: { alignItems: "flex-end" },
  hogerJust: { textAlign: "right" },
});

// Exporteras för komponenter som behöver samma minsta höjd.
export const LISTRAD_MIN = tryck.min;
