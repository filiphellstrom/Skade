import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { MapType } from "react-native-maps";
import { Ikon } from "@/components/ui/Ikon";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { KART_FARGER, avstand, radie, tryck } from "@/theme/tokens";
import type { SparLager } from "./sparLager";

/**
 * Hundspår på Apple Maps (react-native-maps). Kartan zoomar till
 * `fokus` (valt drev, annars alla spår) när valet ändras. Hundspåren
 * ritas med vit kontur under, så att de syns även på satellitbild.
 * Startpunkten för varje hundspår markeras med en liten prick.
 */
export function SparKarta({
  lager,
  fokus,
  hojd,
}: {
  lager: SparLager[];
  fokus: { latitude: number; longitude: number }[];
  hojd: number;
}) {
  const { schema, farger } = useTema();
  const karta = useRef<MapView>(null);
  const [kartTyp, setKartTyp] = useState<MapType>("standard");
  const [redo, setRedo] = useState(false);

  useEffect(() => {
    if (!redo || fokus.length < 2) return;
    karta.current?.fitToCoordinates(fokus, {
      edgePadding: { top: 48, right: 32, bottom: 32, left: 32 },
      animated: true,
    });
  }, [fokus, redo]);

  return (
    <View style={[styles.ram, { height: hojd, borderColor: farger.border }]}>
      <MapView
        ref={karta}
        style={StyleSheet.absoluteFill}
        mapType={kartTyp}
        userInterfaceStyle={schema}
        showsCompass
        showsScale
        showsPointsOfInterest={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapReady={() => setRedo(true)}
      >
        {lager.map((l) =>
          l.typ === "hund" ? (
            [
              <Polyline
                key={`${l.id}-k`}
                coordinates={l.koordinater}
                strokeColor={KART_FARGER.sparKontur}
                strokeWidth={l.bredd + 3}
                zIndex={3}
              />,
              <Polyline key={l.id} coordinates={l.koordinater} strokeColor={l.farg} strokeWidth={l.bredd} zIndex={4} />,
              <Marker
                key={`${l.id}-s`}
                coordinate={l.koordinater[0]}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[styles.start, { backgroundColor: l.farg }]} />
              </Marker>,
            ]
          ) : (
            <Polyline
              key={l.id}
              coordinates={l.koordinater}
              strokeColor={l.farg}
              strokeWidth={l.bredd}
              lineDashPattern={l.streckad ? [6, 6] : undefined}
              zIndex={l.typ === "forare" ? 2 : 1}
            />
          ),
        )}
      </MapView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kartTyp === "standard" ? "Visa satellitbild" : "Visa karta"}
        onPress={() => setKartTyp((t) => (t === "standard" ? "hybrid" : "standard"))}
        style={({ pressed }) => [
          styles.knapp,
          { backgroundColor: farger.surface200, borderColor: farger.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ikon namn="lager" farg={farger.ink} />
        <Txt variant="button">{kartTyp === "standard" ? "Satellit" : "Karta"}</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ram: { borderRadius: radie.md, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  start: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: KART_FARGER.sparKontur },
  knapp: {
    position: "absolute",
    top: avstand.s3,
    right: avstand.s3,
    minHeight: tryck.min,
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s2,
    paddingHorizontal: avstand.s4,
    borderRadius: radie.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
