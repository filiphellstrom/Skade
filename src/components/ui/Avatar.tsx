import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTema } from "@/theme/TemaContext";
import { typ } from "@/theme/tokens";
import { filUri } from "@/utils/filer";
import { Ikon } from "./Ikon";

/**
 * Rund bild för profil och hundar (designen 2026-10-29). Saknas bild visas
 * namnets första bokstav i brand på brandSoft.
 *
 * `bild` är värdet från databasen (filnamn eller data:-URL), se
 * src/utils/filer.ts. `onByt` ger en liten kameraknapp nere till höger.
 */
export function Avatar({
  bild,
  namn,
  storlek = 48,
  onByt,
}: {
  bild: string | null | undefined;
  namn: string;
  storlek?: number;
  onByt?: () => void;
}) {
  const { farger } = useTema();
  const uri = filUri(bild);
  const initial = (namn.trim()[0] ?? "?").toLocaleUpperCase("sv-SE");
  const rund = { width: storlek, height: storlek, borderRadius: storlek / 2 };
  return (
    <View style={{ width: storlek, height: storlek }}>
      {uri ? (
        <Image source={{ uri }} style={[rund, { backgroundColor: farger.surface300 }]} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[rund, styles.mitt, { backgroundColor: farger.brandSoft }]}>
          <Text
            style={{
              fontFamily: typ.title1.fontFamily,
              fontSize: Math.round(storlek * 0.4),
              lineHeight: Math.round(storlek * 0.46),
              color: farger.brand,
            }}
          >
            {initial}
          </Text>
        </View>
      )}
      {onByt && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Byt bild"
          onPress={onByt}
          hitSlop={8}
          style={({ pressed }) => [
            styles.byt,
            { backgroundColor: farger.brand, borderColor: farger.surface100, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ikon namn="kamera" farg={farger.onBrand} storlek={20} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mitt: { alignItems: "center", justifyContent: "center" },
  byt: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
