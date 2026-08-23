import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

interface InlineBannerProps {
  text: string;
  typ?: "error" | "info";
}

/**
 * Liten textrad för fel/status inline i skärmen - t.ex. "ett drev pågår
 * redan" eller "stoppa pågående drev för att avsluta jaktdagen".
 * Medvetet INTE en Alert.alert-modal: modaler kräver precisa tryck och
 * avbryter flödet, vilket går emot "snabbt att starta/stoppa" och
 * "fungerar med handskar" i UX-principerna.
 */
export function InlineBanner({ text, typ = "error" }: InlineBannerProps) {
  const colors = useThemeColors();
  const bakgrund = typ === "error" ? colors.bannerErrorBg : colors.bannerInfoBg;
  const textfarg = typ === "error" ? colors.bannerErrorText : colors.bannerInfoText;

  return (
    <View style={[styles.banner, { backgroundColor: bakgrund }]}>
      <Text style={[styles.text, { color: textfarg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
});
