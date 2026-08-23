import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface SelectableCardProps {
  titel: string;
  undertitel?: string;
  vald: boolean;
  onPress: () => void;
  /** "checkbox" för flerval (Välj hund), "radio" för enval (t.ex. vilken hund är aktiv). */
  typ?: "checkbox" | "radio";
  hoger?: ReactNode;
}

/**
 * Stort tryckbart kort där HELA ytan är tryckyta, inte bara en liten
 * kryssruta - UX-principerna kräver att det går att träffa säkert med
 * handskar. Används för hundlistan i "Välj hund" och för
 * aktiv-hund-valet på timer-skärmen.
 */
export function SelectableCard({
  titel,
  undertitel,
  vald,
  onPress,
  typ = "checkbox",
  hoger,
}: SelectableCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole={typ === "radio" ? "radio" : "checkbox"}
      accessibilityState={{ checked: vald }}
      onPress={onPress}
      style={[
        styles.kort,
        {
          backgroundColor: vald ? colors.surfaceSelected : colors.surface,
          borderColor: vald ? colors.borderSelected : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.markor,
          typ === "radio" && styles.markorRund,
          {
            borderColor: vald ? colors.borderSelected : colors.border,
            backgroundColor: vald ? colors.borderSelected : "transparent",
          },
        ]}
      >
        {vald && <View style={typ === "radio" ? styles.radioPrick : undefined} />}
      </View>

      <View style={styles.textkolumn}>
        <Text style={[styles.titel, { color: colors.text }]}>{titel}</Text>
        {undertitel ? (
          <Text style={[styles.undertitel, { color: colors.textMuted }]}>
            {undertitel}
          </Text>
        ) : null}
      </View>

      {hoger}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kort: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 72,
  },
  markor: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  markorRund: {
    borderRadius: 14,
  },
  radioPrick: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  textkolumn: {
    flex: 1,
  },
  titel: {
    fontSize: 18,
    fontWeight: "700",
  },
  undertitel: {
    fontSize: 14,
    marginTop: 2,
  },
});
