import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "@/theme/colors";

export type BigButtonVariant = "primary" | "danger" | "secondary";

interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: BigButtonVariant;
  disabled?: boolean;
  laddar?: boolean;
  /**
   * Halva höjden av en vanlig BigButton (36 istället för 72) - medveten
   * avvikelse från "stor tryckyta"-principen, som en visuell broms för
   * åtgärder man inte ska trycka på av slentrian. Används just nu bara för
   * "Arkivera hund"/"Radera hund" på app/hund/[hundId].tsx (beslutat
   * 2026-08-29) - inte för bekräftelsestegets knappar, de ska fortfarande
   * vara lätta att träffa säkert när man väl bestämt sig.
   */
  liten?: boolean;
}

/**
 * Stor, fullbredds tryckyta för huvud- och sekundärhandlingar genom hela
 * appen (starta jaktdag, bekräfta hundval, starta/stoppa drev...). Hög
 * höjd och stor text enligt UX-principerna: ska gå att träffa säkert med
 * handskar och läsas i dåligt ljus. Se `liten`-proppen för det medvetna
 * undantaget.
 */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  laddar = false,
  liten = false,
}: BigButtonProps) {
  const colors = useThemeColors();
  const ardisabled = disabled || laddar;

  const bakgrund = ardisabled
    ? colors.disabled
    : variant === "danger"
      ? colors.danger
      : variant === "secondary"
        ? "transparent"
        : colors.primary;

  const bakgrundPressed = ardisabled
    ? colors.disabled
    : variant === "danger"
      ? colors.dangerPressed
      : variant === "secondary"
        ? colors.surfaceSelected
        : colors.primaryPressed;

  const textfarg = ardisabled
    ? colors.disabledText
    : variant === "secondary"
      ? colors.text
      : colors.textOnPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: ardisabled }}
      onPress={ardisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.knapp,
        liten && styles.knappLiten,
        {
          backgroundColor: pressed ? bakgrundPressed : bakgrund,
          borderColor: variant === "secondary" ? colors.border : "transparent",
          borderWidth: variant === "secondary" ? 2 : 0,
        },
      ]}
    >
      {laddar ? (
        <ActivityIndicator color={textfarg} size={liten ? "small" : "large"} />
      ) : (
        <Text style={[styles.text, liten && styles.textLiten, { color: textfarg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  knapp: {
    minHeight: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    width: "100%",
  },
  knappLiten: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  textLiten: {
    fontSize: 14,
  },
});
