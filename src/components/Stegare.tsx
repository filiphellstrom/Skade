import { Pressable, StyleSheet, View } from "react-native";
import { useFarger } from "@/theme/TemaContext";
import { avstand, radie } from "@/theme/tokens";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";

interface StegareProps {
  label: string;
  varde: string;
  onMinus: () => void;
  onPlus: () => void;
}

/**
 * Stegare med etikett ovanför och ‹ värde › under, enligt drev-vyn i
 * designen. Knapparna är 48 px (designen ritar 44 px; vardagslägets
 * tap-min är 56 px men tre stegare måste få plats bredvid varandra på
 * 390 px - flaggat i sprint-6-designlyft.md).
 */
export function Stegare({ label, varde, onMinus, onPlus }: StegareProps) {
  const f = useFarger();
  return (
    <View style={styles.block}>
      <Txt variant="caption" farg="inkMuted">
        {label}
      </Txt>
      <View style={styles.rad}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, minska`}
          onPress={onMinus}
          hitSlop={4}
          style={({ pressed }) => [styles.knapp, { backgroundColor: f.surface300, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ikon namn="tillbaka" farg={f.ink} storlek={22} />
        </Pressable>
        <Txt variant="title2" style={styles.varde}>
          {varde}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, öka`}
          onPress={onPlus}
          hitSlop={4}
          style={({ pressed }) => [styles.knapp, { backgroundColor: f.surface300, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ikon namn="framat" farg={f.ink} storlek={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, gap: avstand.s1, alignItems: "center" },
  rad: { flexDirection: "row", alignItems: "center", gap: avstand.s1 },
  knapp: {
    width: 48,
    height: 48,
    borderRadius: radie.md,
    alignItems: "center",
    justifyContent: "center",
  },
  varde: { minWidth: 40, textAlign: "center", fontVariant: ["tabular-nums"] },
});
