import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { Ikon } from "./Ikon";
import type { IkonNamn } from "./Ikon";
import { Txt } from "./Txt";

const IKONER: Record<string, IkonNamn> = {
  index: "hem",
  hundar: "hund",
  historik: "historik",
  jaktmarker: "jaktmark",
};

/**
 * Flikfältet enligt Design Systemet (components/TabBar): fyra flikar,
 * ikon + text alltid tillsammans, aktiv flik i brand på brandSoft,
 * inaktiv i inkMuted. Varje flik minst tap-min hög.
 *
 * Trycker man på den flik man redan står på hoppar fliken till sin rot
 * (React Navigations standardbeteende via tabPress-eventet).
 */
export function Flikfalt({ state, descriptors, navigation }: BottomTabBarProps) {
  const { farger } = useTema();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.falt,
        {
          backgroundColor: farger.surface200,
          borderTopColor: farger.border,
          paddingBottom: Math.max(insets.bottom, avstand.s2),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const aktiv = state.index === index;
        const titel = descriptors[route.key].options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!aktiv && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktiv }}
            accessibilityLabel={titel}
            onPress={onPress}
            style={[styles.flik, aktiv && { backgroundColor: farger.brandSoft }]}
          >
            <Ikon namn={IKONER[route.name] ?? "hem"} farg={aktiv ? farger.brand : farger.inkMuted} />
            <Txt variant="label" farg={aktiv ? "brand" : "inkMuted"} style={styles.text}>
              {titel}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  falt: {
    flexDirection: "row",
    paddingTop: avstand.s2,
    paddingHorizontal: avstand.s2,
    borderTopWidth: 1,
    gap: avstand.s1,
  },
  flik: {
    flex: 1,
    minHeight: tryck.min,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radie.md,
  },
  // Design Systemet: fliktext 12 px, vikt 600, utan versaler/spärrning.
  text: { letterSpacing: 0, fontFamily: "SchibstedGrotesk_600SemiBold" },
});
