import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface InfoRowProps {
  titel: string;
  undertitel?: string;
  /** Kort text längst till höger, t.ex. total drevtid eller en "Pågår"-status. */
  hoger?: string;
  /**
   * Sprint 3: om satt blir hela raden tryckbar (t.ex. huvudskärmens
   * hundlista → app/hund/[hundId].tsx för att redigera hunden) och en
   * liten pil visas till höger som tryckbarhets-hint. Utan onPress är
   * raden kvar som ren visning, precis som tidigare.
   */
  onPress?: () => void;
}

/**
 * Informationsrad - samma kortstil som SelectableCard men utan
 * val-markör. Används för huvudskärmens hundlista och
 * pågående-jaktdag-sammanfattningen. Tryckbar när `onPress` skickas in,
 * annars ren visning.
 */
export function InfoRow({ titel, undertitel, hoger, onPress }: InfoRowProps) {
  const colors = useThemeColors();

  const innehall = (
    <>
      <View style={styles.textkolumn}>
        <Text style={[styles.titel, { color: colors.text }]} numberOfLines={1}>
          {titel}
        </Text>
        {undertitel ? (
          <Text style={[styles.undertitel, { color: colors.textMuted }]}>
            {undertitel}
          </Text>
        ) : null}
      </View>
      {hoger ? (
        <Text style={[styles.hoger, { color: colors.primary }]}>{hoger}</Text>
      ) : null}
      {onPress ? (
        <Text style={[styles.pil, { color: colors.textMuted }]}>›</Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.rad,
          {
            backgroundColor: pressed ? colors.surfaceSelected : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {innehall}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.rad,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {innehall}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  textkolumn: {
    flex: 1,
  },
  titel: {
    fontSize: 17,
    fontWeight: "700",
  },
  undertitel: {
    fontSize: 14,
    marginTop: 2,
  },
  hoger: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 12,
  },
  pil: {
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 8,
  },
});
