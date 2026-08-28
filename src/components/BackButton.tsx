import { Pressable, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { useThemeColors } from "@/theme/colors";

interface BackButtonProps {
  onPress?: () => void;
}

/**
 * Stor, fristående tillbaka-knapp - komplement till (inte ersättning för)
 * swipe-tillbaka-gesten. Beslutat i Sprint 2 (2026-08-23): swipe är svårt
 * att träffa precist med jakthandskar i kallt väder, så alla steg i
 * jaktdags-flödet (ny/välj-hund/timer) ska ha en tydlig, stor tryckyta för
 * att gå tillbaka istället för att bara lita på gesten.
 *
 * Standardbeteendet går ett steg bakåt i navigationshistoriken om det går
 * (router.canGoBack()), annars till huvudskärmen - täcker fallet att
 * skärmen öppnats direkt (t.ex. framtida deep link) utan historik att gå
 * tillbaka i. Skicka en egen `onPress` för att override:a vid behov.
 */
export function BackButton({ onPress }: BackButtonProps) {
  const colors = useThemeColors();

  const handlePress =
    onPress ??
    (() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tillbaka"
      onPress={handlePress}
      style={styles.knapp}
      hitSlop={8}
    >
      <Text style={[styles.text, { color: colors.text }]}>‹ Tillbaka</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  knapp: {
    minHeight: 48,
    paddingVertical: 12,
    paddingRight: 16,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 17,
    fontWeight: "700",
  },
});
