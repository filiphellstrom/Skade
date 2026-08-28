import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface InfoRowProps {
  titel: string;
  undertitel?: string;
  /** Kort text längst till höger, t.ex. total drevtid eller en "Pågår"-status. */
  hoger?: string;
}

/**
 * Icke-tryckbar informationsrad - samma kortstil som SelectableCard men
 * utan val-markör, för ren visning (huvudskärmens hundlista och
 * pågående-jaktdag-sammanfattningen). Om raden någon gång ska bli
 * tryckbar (t.ex. navigera till en hunds historik i en senare sprint) är
 * SelectableCard rätt byggsten istället, inte den här.
 */
export function InfoRow({ titel, undertitel, hoger }: InfoRowProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.rad,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
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
});
