import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker, Polygon, Polyline } from "react-native-maps";
import type { Kartpunkt } from "@/db/types";
import { FONT, KART_FARGER, medAlfa } from "@/theme/tokens";
import { arPass, kategoriNamn } from "@/vind/gpx";
import type { LatLon } from "@/vind/geo";
import type { Vindpil } from "@/vind/pilar";
import type { Vittringszon } from "@/vind/vittring";

/**
 * Kartlagren för Vind och vittring. Allt ritas i lat/lon (Polygon,
 * Polyline), så att det följer med när kartan vrids och zoomas. Bara
 * jägarpositionen och kartpunkterna är Marker-vyer.
 *
 * Hundens position: Skade har ingen GPS-källa för hunden än (Garmin är
 * inte kopplat). När den finns läggs ett HundLager till här bredvid
 * jägarens position - inget annat i kartan behöver ändras.
 */

/** Jaktmarkens gräns, bara kontur. */
export const GransLager = memo(function GransLager({ punkter }: { punkter: LatLon[] }) {
  if (punkter.length < 3) return null;
  return (
    <Polygon
      coordinates={punkter}
      strokeColor={KART_FARGER.grans}
      strokeWidth={3}
      fillColor={medAlfa(KART_FARGER.grans, 0.04)}
      tappable={false}
      zIndex={1}
    />
  );
});

function punktFarg(typ: string): string {
  switch (typ) {
    case "stand":
      return KART_FARGER.pass;
    case "tower":
      return KART_FARGER.torn;
    case "parking":
      return KART_FARGER.parkering;
    case "salt_stone":
    case "feeding_grounds":
    case "bait":
      return KART_FARGER.foder;
    default:
      return KART_FARGER.ovrigt;
  }
}

/**
 * En markering. Pass och torn har namnetikett (när `visaNamn`) och går
 * att trycka på för att välja som jägarposition.
 */
export const PunktMarkor = memo(function PunktMarkor({
  punkt,
  visaNamn,
  vald,
  onValj,
}: {
  punkt: Kartpunkt;
  visaNamn: boolean;
  vald: boolean;
  onValj: (p: Kartpunkt) => void;
}) {
  const pass = arPass(punkt.typ);
  const farg = punktFarg(punkt.typ);
  return (
    <Marker
      coordinate={{ latitude: punkt.lat, longitude: punkt.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={() => onValj(punkt)}
      accessibilityLabel={`${kategoriNamn(punkt.typ)} ${punkt.namn}`}
      zIndex={pass ? 4 : 3}
      // Nyckeln i föräldern innehåller visaNamn/vald så att vyn ritas om.
    >
      <View style={styles.punktRad} pointerEvents="none">
        <View
          style={[
            styles.prick,
            pass && styles.prickPass,
            { backgroundColor: farg, borderColor: vald ? KART_FARGER.vittringKant : KART_FARGER.etikettYta },
          ]}
        />
        {visaNamn && !!punkt.namn && (
          <View style={styles.etikett}>
            <Text style={styles.etikettText} numberOfLines={1}>
              {punkt.namn}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
});

/** Vindpilar: mörk kontur under, ljus pil över. */
export const PilLager = memo(function PilLager({ pilar }: { pilar: Vindpil[] }) {
  return (
    <>
      {pilar.map((p, i) => (
        <PilRitning key={i} pil={p} />
      ))}
    </>
  );
});

function PilRitning({ pil }: { pil: Vindpil }) {
  return (
    <>
      <Polyline
        coordinates={pil.skaft}
        strokeColor={medAlfa(KART_FARGER.pilKontur, 0.55)}
        strokeWidth={pil.tjocklek + 2.5}
        lineCap="round"
        zIndex={5}
      />
      <Polyline
        coordinates={pil.huvud}
        strokeColor={medAlfa(KART_FARGER.pilKontur, 0.55)}
        strokeWidth={pil.tjocklek + 2.5}
        lineCap="round"
        lineJoin="round"
        zIndex={5}
      />
      <Polyline
        coordinates={pil.skaft}
        strokeColor={medAlfa(KART_FARGER.pil, 0.92)}
        strokeWidth={pil.tjocklek}
        lineCap="round"
        zIndex={6}
      />
      <Polyline
        coordinates={pil.huvud}
        strokeColor={medAlfa(KART_FARGER.pil, 0.92)}
        strokeWidth={pil.tjocklek}
        lineCap="round"
        lineJoin="round"
        zIndex={6}
      />
    </>
  );
}

/** Vittringszonen: tre mjuka lager, yttersta underst, och en streckad mittlinje. */
export const ZonLager = memo(function ZonLager({ zon }: { zon: Vittringszon }) {
  return (
    <>
      {zon.lager.map((l, i) => (
        <Polygon
          key={i}
          coordinates={l.punkter}
          fillColor={medAlfa(KART_FARGER.vittring, l.styrka)}
          strokeColor={i === 0 ? medAlfa(KART_FARGER.vittringKant, 0.35) : "transparent"}
          strokeWidth={i === 0 ? 1 : 0}
          tappable={false}
          zIndex={2 + i * 0.1}
        />
      ))}
      <Polyline
        coordinates={zon.mittlinje}
        strokeColor={medAlfa(KART_FARGER.vittringKant, 0.8)}
        strokeWidth={2}
        lineDashPattern={[6, 6]}
        zIndex={2.5}
      />
    </>
  );
});

/** Vald jägarposition (tillfällig punkt, pass eller egen position). */
export const JagareMarkor = memo(function JagareMarkor({ position }: { position: LatLon }) {
  return (
    <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={10}>
      <View style={styles.jagare} pointerEvents="none">
        <View style={styles.jagareKarna} />
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  punktRad: { flexDirection: "row", alignItems: "center", gap: 3 },
  prick: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  prickPass: { width: 13, height: 13, borderRadius: 7 },
  etikett: {
    backgroundColor: KART_FARGER.etikettYta,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  etikettText: { color: KART_FARGER.etikettText, fontSize: 11, fontFamily: FONT[600] },
  jagare: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: KART_FARGER.jagareKant,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 4px rgba(0,0,0,0.35)",
  },
  jagareKarna: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: KART_FARGER.jagare,
  },
});
