import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Marker, Polyline } from "react-native-maps";
import { KART_FARGER } from "@/theme/tokens";
import type { SparLager } from "@/components/spar/sparLager";

/**
 * Hundspår från Garmin på Karta-fliken (2026-11-15), ritade som på
 * jaktdagens spårkarta: hundspåren med vit kontur och en färg per drev,
 * förarens spår streckat och halsbandets spår utanför dreven tunt och grått.
 */
export const HundsparLager = memo(function HundsparLager({ lager }: { lager: SparLager[] }) {
  return (
    <>
      {lager.map((l) =>
        l.typ === "hund" ? (
          [
            <Polyline key={`${l.id}-k`} coordinates={l.koordinater} strokeColor={KART_FARGER.sparKontur} strokeWidth={l.bredd + 3} zIndex={3} />,
            <Polyline key={l.id} coordinates={l.koordinater} strokeColor={l.farg} strokeWidth={l.bredd} zIndex={4} />,
            <Marker key={`${l.id}-s`} coordinate={l.koordinater[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={5}>
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
    </>
  );
});

const styles = StyleSheet.create({
  start: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: KART_FARGER.sparKontur },
});
