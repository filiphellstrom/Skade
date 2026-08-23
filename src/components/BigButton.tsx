import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "@/theme/colors";

export type BigButtonVariant = "primary" | "danger" | "secondary";

interface BigButtonProps {
  label: string;
  onPress: () => void;
  variant?: BigButtonVariant;
  disabled?: boolean;
  laddar?: boolean;
}

/**
 * Stor, fullbredds tryckyta för huvud- och sekundärhandlingar genom hela
 * appen (starta jaktdag, bekräfta hundval, starta/stoppa drev...). Hög
 * höjd och stor text enligt UX-principerna: ska gå att träffa säkert med
 * handskar och läsas i dåligt ljus.
 */
export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  laddar = false,
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
        {
          backgroundColor: pressed ? bakgrundPressed : bakgrund,
          borderColor: variant === "secondary" ? colors.border : "transparent",
          borderWidth: variant === "secondary" ? 2 : 0,
        },
      ]}
    >
      {laddar ? (
        <ActivityIndicator color={textfarg} />
      ) : (
        <Text style={[styles.text, { color: textfarg }]}>{label}</Text>
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
  text: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});
