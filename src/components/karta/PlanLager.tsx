import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker, Polygon, Polyline } from "react-native-maps";
import { FONT, KART_FARGER, medAlfa } from "@/theme/tokens";
import { arPass } from "@/vind/gpx";
import { eftersokLage } from "@/jaktlag/format";
import type { Eftersok, PlanInnehall, Punkt, Uppdrag } from "@/jaktlag/typer";
import { punktFarg } from "./punktfarg";

/**
 * Jaktplanen och eftersöken på appens karta (react-native-maps).
 * Samma regler och symboler som på webben (planLeaflet.ts):
 * uppdraget i fokus ritas fullt ut – S = släpplats, A = start, B = mål,
 * ! = viktig punkt – och de andras bara som en liten märkt släpplats.
 * Deras rutter visas tunna och streckade först när visaAllaRutter är på.
 *
 * Markörerna ritas en gång (tracksViewChanges av), så nycklarna i listorna
 * innehåller det som kan ändras.
 */

const kord = (p: Punkt) => ({ latitude: p.lat, longitude: p.lon });

function initialer(namn: string): string {
  const delar = namn.trim().split(/\s+/).filter(Boolean);
  if (delar.length === 0) return "?";
  return (delar.length > 1 ? delar[0][0] + delar[delar.length - 1][0] : delar[0].slice(0, 2)).toUpperCase();
}

function Symbol({
  text,
  storlek,
  fyll,
  kant,
  farg,
  fyrkant = false,
  etikett,
}: {
  text: string;
  storlek: number;
  fyll: string;
  kant: string;
  farg: string;
  fyrkant?: boolean;
  etikett?: string;
}) {
  return (
    <View style={styles.rad} pointerEvents="none">
      <View
        style={[
          styles.symbol,
          {
            width: storlek,
            height: storlek,
            borderRadius: fyrkant ? 5 : storlek / 2,
            backgroundColor: fyll,
            borderColor: kant,
          },
        ]}
      >
        <Text style={[styles.symbolText, { color: farg, fontSize: Math.max(9, Math.round(storlek * 0.42)) }]}>{text}</Text>
      </View>
      {!!etikett && (
        <View style={styles.etikett}>
          <Text style={styles.etikettText} numberOfLines={1}>
            {etikett}
          </Text>
        </View>
      )}
    </View>
  );
}

function UppdragLager({ u, fokus, visaRutt }: { u: Uppdrag; fokus: boolean; visaRutt: boolean }) {
  const rubrik = `${u.forare || "Hundförare"}${u.hund ? `, ${u.hund}` : ""}`;
  return (
    <>
      {u.rutt.length >= 2 && fokus && (
        <Polyline coordinates={u.rutt.map(kord)} strokeColor="rgba(255,255,255,0.9)" strokeWidth={7} lineCap="round" lineJoin="round" zIndex={7} />
      )}
      {u.rutt.length >= 2 && (fokus || visaRutt) && (
        <Polyline
          coordinates={u.rutt.map(kord)}
          strokeColor={fokus ? u.farg : medAlfa(u.farg, 0.75)}
          strokeWidth={fokus ? 4 : 2}
          lineDashPattern={fokus ? undefined : [6, 6]}
          lineCap="round"
          lineJoin="round"
          zIndex={fokus ? 8 : 6}
        />
      )}
      {fokus &&
        u.rutt.map((p, i) => {
          const forst = i === 0;
          const sist = i === u.rutt.length - 1 && u.rutt.length > 1;
          const typ = forst ? "Start" : sist ? "Mål" : p.viktig ? "Viktig punkt" : "Viapunkt";
          return (
            <Marker
              key={`${p.id}-${p.viktig ? 1 : 0}-${p.text ?? ""}-${forst ? "a" : sist ? "b" : "v"}`}
              coordinate={kord(p)}
              anchor={{ x: p.viktig || p.text ? 0.12 : 0.5, y: 0.5 }}
              tracksViewChanges={false}
              accessibilityLabel={`${typ}${p.text ? `: ${p.text}` : ""}`}
              zIndex={p.viktig ? 12 : 11}
            >
              {p.viktig ? (
                <Symbol text="!" storlek={24} fyll={u.farg} kant="#ffffff" farg="#ffffff" fyrkant etikett={p.text || "Viktig punkt"} />
              ) : forst || sist ? (
                <Symbol text={forst ? "A" : "B"} storlek={22} fyll="#ffffff" kant={u.farg} farg={u.farg} etikett={p.text} />
              ) : (
                <Symbol text="" storlek={12} fyll={u.farg} kant="#ffffff" farg="#ffffff" etikett={p.text} />
              )}
            </Marker>
          );
        })}
      {u.slapp && (
        <Marker
          key={`slapp-${fokus ? 1 : 0}-${u.slappTid ?? ""}-${u.forare}`}
          coordinate={kord(u.slapp)}
          anchor={{ x: fokus ? 0.2 : 0.5, y: 0.5 }}
          tracksViewChanges={false}
          accessibilityLabel={`Släpplats, ${rubrik}${u.slappTid ? `, klockan ${u.slappTid}` : ""}`}
          title={fokus ? undefined : rubrik}
          description={fokus ? undefined : u.slappTid ? `Släpper ${u.slappTid}` : "Släpplats"}
          zIndex={fokus ? 13 : 9}
        >
          {fokus ? (
            <Symbol text="S" storlek={30} fyll={u.farg} kant="#ffffff" farg="#ffffff" etikett={`Släpp${u.slappTid ? ` ${u.slappTid}` : ""}`} />
          ) : (
            <Symbol text={initialer(u.forare)} storlek={26} fyll={medAlfa(u.farg, 0.85)} kant="#ffffff" farg="#ffffff" />
          )}
        </Marker>
      )}
    </>
  );
}

export const PlanLager = memo(function PlanLager({
  innehall,
  fokusId,
  visaAllaRutter,
  visaJaktmark,
  visaNamn,
}: {
  innehall: PlanInnehall;
  fokusId: string | null;
  visaAllaRutter: boolean;
  /** Rita planens gräns och pass. Av när samma jaktmark redan finns importerad i telefonen. */
  visaJaktmark: boolean;
  visaNamn: boolean;
}) {
  const mark = visaJaktmark ? innehall.jaktmark : null;
  const s = innehall.samling;
  return (
    <>
      {mark && mark.grans.length >= 3 && (
        <Polygon
          coordinates={mark.grans.map(([lat, lon]) => ({ latitude: lat, longitude: lon }))}
          strokeColor={KART_FARGER.grans}
          strokeWidth={3}
          fillColor={medAlfa(KART_FARGER.grans, 0.04)}
          tappable={false}
          zIndex={1}
        />
      )}
      {mark?.punkter.map((p, i) => {
        const pass = arPass(p.typ);
        const namn = visaNamn && pass ? p.namn : "";
        return (
          <Marker
            key={`pm-${i}-${namn}`}
            coordinate={{ latitude: p.lat, longitude: p.lon }}
            anchor={{ x: namn ? 0.15 : 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={p.namn || undefined}
            zIndex={pass ? 4 : 3}
          >
            <Symbol text="" storlek={pass ? 13 : 10} fyll={punktFarg(p.typ)} kant={KART_FARGER.etikettYta} farg="#ffffff" etikett={namn} />
          </Marker>
        );
      })}
      {s && (
        <Marker
          key={`samling-${s.tid ?? ""}`}
          coordinate={kord(s)}
          anchor={{ x: 0.2, y: 0.5 }}
          tracksViewChanges={false}
          accessibilityLabel={`Samling${s.tid ? ` klockan ${s.tid}` : ""}`}
          zIndex={10}
        >
          <Symbol text="⚑" storlek={26} fyll="#14201b" kant="#ffffff" farg="#ffffff" fyrkant etikett={`Samling${s.tid ? ` ${s.tid}` : ""}`} />
        </Marker>
      )}
      {innehall.uppdrag
        .filter((u) => u.id !== fokusId)
        .map((u) => (
          <UppdragLager key={u.id} u={u} fokus={false} visaRutt={visaAllaRutter} />
        ))}
      {innehall.uppdrag
        .filter((u) => u.id === fokusId)
        .map((u) => (
          <UppdragLager key={u.id} u={u} fokus visaRutt />
        ))}
    </>
  );
});

/** Öppna (röda) och tagna (gula) eftersök. Tryck öppnar eftersöket. */
export const EftersokLager = memo(function EftersokLager({
  eftersok,
  onValj,
}: {
  eftersok: Eftersok[];
  onValj: (e: Eftersok) => void;
}) {
  return (
    <>
      {eftersok.map((e) => (
        <Marker
          key={`${e.id}-${e.status}-${e.vantar ? 1 : 0}`}
          coordinate={{ latitude: e.lat, longitude: e.lon }}
          anchor={{ x: 0.18, y: 0.5 }}
          tracksViewChanges={false}
          accessibilityLabel={`Eftersök${e.viltart ? ` ${e.viltart}` : ""}. ${eftersokLage(e)}`}
          onPress={() => onValj(e)}
          zIndex={14}
        >
          <Symbol
            text="E"
            storlek={26}
            fyll={e.status === "oppet" ? "#c0392b" : "#c98a00"}
            kant="#ffffff"
            farg="#ffffff"
            etikett={e.status === "oppet" ? "Eftersök" : "Eftersök, taget"}
          />
        </Marker>
      ))}
    </>
  );
});

/** En utpekad plats ("Visa på kartan"). */
export function UtpekadMarkor({ punkt, namn }: { punkt: Punkt; namn: string }) {
  return (
    <Marker key={`utpekad-${namn}`} coordinate={kord(punkt)} anchor={{ x: 0.18, y: 0.5 }} tracksViewChanges={false} zIndex={15}>
      <Symbol text="" storlek={18} fyll="#14201b" kant="#ffffff" farg="#ffffff" etikett={namn} />
    </Marker>
  );
}

/** Alla punkter i en plan, för att zooma så att allt syns. */
export function planPunkter(innehall: PlanInnehall): { latitude: number; longitude: number }[] {
  return [
    ...(innehall.jaktmark?.grans ?? []).map(([lat, lon]) => ({ latitude: lat, longitude: lon })),
    ...(innehall.jaktmark?.punkter ?? []).map((p) => ({ latitude: p.lat, longitude: p.lon })),
    ...(innehall.samling ? [kord(innehall.samling)] : []),
    ...innehall.uppdrag.flatMap((u) => [...(u.slapp ? [kord(u.slapp)] : []), ...u.rutt.map(kord)]),
  ];
}

const styles = StyleSheet.create({
  rad: { flexDirection: "row", alignItems: "center", gap: 3 },
  symbol: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 4px rgba(0,0,0,0.4)",
  },
  symbolText: { fontFamily: FONT[700], includeFontPadding: false },
  etikett: {
    backgroundColor: KART_FARGER.etikettYta,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    maxWidth: 180,
  },
  etikettText: { color: KART_FARGER.etikettText, fontSize: 11, fontFamily: FONT[600] },
});
