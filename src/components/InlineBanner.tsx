import { StyleSheet, View } from "react-native";
import { useFarger } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

interface InlineBannerProps {
  text: string;
  typ?: "error" | "info";
}

/**
 * Fel: signal-text på surface200 (Design Systemet: "Felmeddelanden säger
 * vad som hände och vad man gör härnäst, i signal-text").
 * Info: ink på brandSoft. Alltid ikon + text.
 */
export function InlineBanner({ text, typ = "error" }: InlineBannerProps) {
  const f = useFarger();
  const fel = typ === "error";
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: fel ? f.surface200 : f.brandSoft, borderColor: fel ? f.signal : "transparent" }]}
    >
      <Ikon namn="varning" farg={fel ? f.signal : f.brand} storlek={20} />
      <Txt variant="body" farg={fel ? "signal" : "ink"} style={styles.text}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: avstand.s2,
    padding: avstand.s3,
    borderRadius: radie.md,
    borderWidth: 1.5,
  },
  text: { flex: 1 },
});
