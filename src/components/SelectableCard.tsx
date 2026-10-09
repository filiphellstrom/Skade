import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { useFarger } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

interface SelectableCardProps {
  titel: string;
  undertitel?: string;
  vald: boolean;
  onPress: () => void;
  /** "checkbox" för flerval (Välj hundar), "radio" för enval (aktiv hund). */
  typ?: "checkbox" | "radio";
  hoger?: ReactNode;
}

/**
 * Val-kort enligt Design Systemet: minst tap-min högt, hela ytan är
 * tryckyta. Ej vald: surface200 med border-strong-kant. Vald: brandSoft
 * med brand-kant, en bock och ordet "Vald" - aldrig bara färg.
 */
export function SelectableCard({
  titel,
  undertitel,
  vald,
  onPress,
  typ = "checkbox",
  hoger,
}: SelectableCardProps) {
  const f = useFarger();
  return (
    <Pressable
      accessibilityRole={typ === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ checked: vald }}
      accessibilityLabel={[titel, undertitel].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kort,
        {
          backgroundColor: vald ? f.brandSoft : f.surface200,
          borderColor: vald ? f.brand : f.borderStrong,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.textkolumn}>
        <Txt variant="heading">{titel}</Txt>
        {!!undertitel && (
          <Txt variant="caption" farg="inkMuted">
            {undertitel}
          </Txt>
        )}
      </View>
      {hoger}
      {vald && (
        <View style={styles.vald}>
          <Ikon namn="bock" farg={f.brand} storlek={20} linje={2.25} />
          <Txt variant="caption" farg="brand" style={styles.valdText}>
            Vald
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kort: {
    minHeight: tryck.min,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    paddingHorizontal: avstand.s4,
    paddingVertical: avstand.s2,
    borderRadius: radie.md,
    borderWidth: 2,
  },
  textkolumn: { flex: 1, gap: 2 },
  vald: { flexDirection: "row", alignItems: "center", gap: avstand.s1 },
  valdText: { fontWeight: "600" },
});
