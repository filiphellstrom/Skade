import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import * as Haptics from "expo-haptics";
import { useFarger } from "@/theme/TemaContext";
import { radie } from "@/theme/tokens";
import { Txt } from "@/components/ui/Txt";

/** Radhöjd i hjulet. Fem rader syns, den mittersta är vald. */
export const RAD = 44;
const SYNLIGA = 5;
const KANT = RAD * Math.floor(SYNLIGA / 2);

interface RullhjulProps {
  varden: number[];
  valt: number;
  onChange: (varde: number) => void;
  format: (varde: number) => string;
  /** Läses upp av VoiceOver, t.ex. "Starttid, timme". */
  etikett: string;
}

/**
 * Rullhjul i iOS-stil som man swipear upp och ner (tidsvalet i drev-vyn,
 * förslag B i designfilen, valt av Filip 2026-10-09). Snäpper mot
 * varje rad. Det som står i det markerade mittfältet är valt, och värdet
 * skickas med onChange medan man rullar. Ett tryck på en rad rullar dit.
 *
 * Egen komponent i stället för den inbyggda iOS-pickern så att samma hjul
 * fungerar i webbversionen och följer appens tema.
 *
 * Tillgänglighet: hjulet är "adjustable" - VoiceOver svep upp/ner stegar
 * ett värde i taget.
 */
export function Rullhjul({ varden, valt, onChange, format, etikett }: RullhjulProps) {
  const f = useFarger();
  const ref = useRef<ScrollView>(null);
  const valtIndex = Math.max(0, varden.indexOf(valt));
  const [index, setIndex] = useState(valtIndex);
  const indexRef = useRef(valtIndex);
  const startat = useRef(false);

  // Värdet kan ändras utifrån (t.ex. när arket byter mellan start och slut).
  useEffect(() => {
    if (valtIndex !== indexRef.current) {
      indexRef.current = valtIndex;
      setIndex(valtIndex);
      ref.current?.scrollTo({ y: valtIndex * RAD, animated: false });
    }
  }, [valtIndex]);

  const vidRullning = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(varden.length - 1, Math.round(e.nativeEvent.contentOffset.y / RAD)));
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      onChange(varden[i]);
    }
  };

  const ga = (i: number, animerat = true) => {
    const ny = Math.max(0, Math.min(varden.length - 1, i));
    ref.current?.scrollTo({ y: ny * RAD, animated: animerat });
    if (!animerat && ny !== indexRef.current) {
      indexRef.current = ny;
      setIndex(ny);
      onChange(varden[ny]);
    }
  };

  return (
    <View
      style={styles.hjul}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={etikett}
      accessibilityValue={{ text: format(varden[index]) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => ga(index + (e.nativeEvent.actionName === "increment" ? 1 : -1), false)}
    >
      <View pointerEvents="none" style={[styles.markering, { backgroundColor: f.surface300 }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={RAD}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={vidRullning}
        contentOffset={{ x: 0, y: valtIndex * RAD }}
        onLayout={() => {
          // contentOffset fungerar inte på webben - sätt startläget en gång.
          if (!startat.current) {
            startat.current = true;
            ref.current?.scrollTo({ y: indexRef.current * RAD, animated: false });
          }
        }}
        contentContainerStyle={styles.innehall}
      >
        {varden.map((v, i) => {
          const avstand = Math.abs(i - index);
          return (
            <Pressable
              key={v}
              onPress={() => ga(i)}
              importantForAccessibility="no"
              accessibilityElementsHidden
              style={styles.rad}
            >
              <Txt
                variant="title2"
                farg={avstand === 0 ? "ink" : "inkMuted"}
                style={[styles.text, { opacity: avstand === 0 ? 1 : avstand === 1 ? 0.7 : 0.35 }]}
              >
                {format(v)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hjul: { flex: 1, height: RAD * SYNLIGA },
  markering: {
    position: "absolute",
    left: 0,
    right: 0,
    top: KANT,
    height: RAD,
    borderRadius: radie.md,
  },
  innehall: { paddingVertical: KANT },
  rad: { height: RAD, alignItems: "center", justifyContent: "center" },
  text: { fontVariant: ["tabular-nums"] },
});
