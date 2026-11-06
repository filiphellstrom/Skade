import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ikon } from "@/components/ui/Ikon";
import { Knapp } from "@/components/ui/Knapp";
import { Segment, ValChip, VarningsChip } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";
import { useTema } from "@/theme/TemaContext";
import { avstand, radie, tryck } from "@/theme/tokens";
import { kompassStreck, riktningsText } from "@/vind/riktning";
import { aktualitet } from "@/vind/prognos";
import type { VindPrognos, VindSteg } from "@/vind/prognos";
import type { Vittringszon } from "@/vind/vittring";
import { Kompass } from "./Kompass";

/**
 * Prognospanelen i Vind och vittring. Ihopfälld: en rad med kompass,
 * vind och vald tid - kartan dominerar. Utfälld: värden, tidsreglage,
 * vittringszonens inställningar och källa/aktualitet.
 *
 * Panelen skiljer tydligt på vad som är PROGNOS (siffrorna från källan)
 * och vad som är UPPSKATTNING (vittringszonen).
 */

export type Langdval = "auto" | 200 | 400 | 600 | 900;
export const LANGDVAL: { varde: Langdval; titel: string }[] = [
  { varde: "auto", titel: "Auto" },
  { varde: 200, titel: "200 m" },
  { varde: 400, titel: "400 m" },
  { varde: 600, titel: "600 m" },
  { varde: 900, titel: "900 m" },
];
export const BREDDVAL: { varde: "smal" | "normal" | "bred"; titel: string; faktor: number }[] = [
  { varde: "smal", titel: "Smal", faktor: 0.6 },
  { varde: "normal", titel: "Normal", faktor: 1 },
  { varde: "bred", titel: "Bred", faktor: 1.6 },
];

const DAGAR = ["sön", "mån", "tis", "ons", "tors", "fre", "lör"];
const pad = (n: number) => String(n).padStart(2, "0");
export const klocka = (t: number) => {
  const d = new Date(t * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dagEtikett = (t: number, nu: number) => {
  const d = new Date(t * 1000);
  const idag = new Date(nu * 1000);
  const imorgon = new Date((nu + 86400) * 1000);
  if (d.toDateString() === idag.toDateString()) return "i dag";
  if (d.toDateString() === imorgon.toDateString()) return "i morgon";
  return `${DAGAR[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};
const ms = (v: number | null) => (v === null ? "–" : v.toFixed(1).replace(".", ","));
const sedan = (t: number, nu: number) => {
  const min = Math.max(0, Math.round((nu - t) / 60));
  if (min < 60) return `${min} min sedan`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h sedan` : `${Math.round(h / 24)} dygn sedan`;
};

interface Props {
  oppen: boolean;
  setOppen: (v: boolean) => void;
  nu: number;
  prognos: VindPrognos | null;
  steg: VindSteg | null;
  franMinne: boolean;
  laddar: boolean;
  fel: string | null;
  onForsokIgen: () => void;
  tider: number[];
  valdTid: number | null;
  setValdTid: (t: number) => void;
  positionNamn: string | null;
  kanAterstalla: boolean;
  onAterstall: () => void;
  zonPa: boolean;
  setZonPa: (v: boolean) => void;
  langd: Langdval;
  setLangd: (v: Langdval) => void;
  bredd: "smal" | "normal" | "bred";
  setBredd: (v: "smal" | "normal" | "bred") => void;
  zon: Vittringszon | null;
  maxHojd: number;
}

export function VindPanel(p: Props) {
  const { farger, kortSkugga } = useTema();
  const status = aktualitet(p.prognos, p.nu);
  const riktning = p.steg?.franGrader ?? null;
  const harVind = !!p.steg && riktning !== null && p.steg.medelvind !== null;

  const kortRad = harVind
    ? `${kompassStreck(riktning)} ${ms(p.steg?.medelvind ?? null)} m/s${
        p.steg?.byvind != null ? ` (byar ${ms(p.steg.byvind)})` : ""
      }`
    : p.laddar
      ? "Hämtar vind…"
      : p.positionNamn
        ? "Vinddata saknas"
        : "Tryck på kartan eller ett pass";

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: farger.surface200, borderColor: farger.border, boxShadow: kortSkugga },
      ]}
    >
      {/* Rubrikraden - alltid synlig, tryck för att fälla ut/ihop. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: p.oppen }}
        accessibilityLabel={`Vind och vittring. ${harVind ? riktningsText(riktning) : kortRad}. ${p.oppen ? "Fäll ihop" : "Visa mer"}`}
        onPress={() => p.setOppen(!p.oppen)}
        style={styles.huvud}
      >
        <Kompass franGrader={harVind ? riktning : null} storlek={52} />
        <View style={styles.flex1}>
          <Txt variant="caption" farg="inkMuted">
            VIND OCH VITTRING{p.valdTid !== null ? ` · ${dagEtikett(p.valdTid, p.nu)} ${klocka(p.valdTid)}` : ""}
          </Txt>
          <Txt variant="heading">
            {kortRad}
          </Txt>
        </View>
        <Ikon namn={p.oppen ? "ned" : "upp"} farg={farger.inkMuted} />
      </Pressable>

      {/* Tidsreglaget syns även ihopfällt - det är det man oftast ändrar. */}
      {p.tider.length > 0 && (
        <Tidsreglage tider={p.tider} vald={p.valdTid} onVal={p.setValdTid} nu={p.nu} />
      )}

      {p.oppen && (
        <ScrollView style={{ maxHeight: p.maxHojd }} contentContainerStyle={styles.innehall}>
          {/* PROGNOS */}
          {harVind ? (
            <View style={styles.block}>
              <Txt variant="bodyStrong">{riktningsText(riktning)}</Txt>
              <View style={styles.varden}>
                <Varde etikett="Riktning" varde={`${kompassStreck(riktning)} ${Math.round(riktning)}°`} />
                <Varde etikett="Medelvind" varde={`${ms(p.steg?.medelvind ?? null)} m/s`} />
                <Varde
                  etikett="Byvind"
                  varde={p.steg?.byvind != null ? `${ms(p.steg.byvind)} m/s` : "saknas"}
                />
              </View>
            </View>
          ) : (
            <Txt farg="inkMuted">
              {p.laddar
                ? "Hämtar prognosen…"
                : !p.positionNamn
                  ? "Tryck på kartan för att placera en jägarposition, eller tryck på ett pass."
                  : p.prognos
                    ? "Prognosen har inga vindvärden för den här tiden. Ingen pil eller zon visas."
                    : "Ingen vindprognos för den här platsen. Ingen pil eller zon visas."}
            </Txt>
          )}

          {/* Position */}
          <View style={styles.block}>
            <Txt variant="caption" farg="inkMuted">
              POSITION
            </Txt>
            <Txt>{p.positionNamn ?? "Ingen vald"}</Txt>
            <Txt variant="caption" farg="inkMuted">
              Tryck på kartan för en tillfällig position, eller på ett pass eller torn.
            </Txt>
            {p.kanAterstalla && (
              <Knapp variant="sekundar" ikon="position" titel="Återställ till min position" onPress={p.onAterstall} />
            )}
          </View>

          {/* UPPSKATTNING: vittringszonen */}
          <View style={styles.block}>
            <Txt variant="caption" farg="inkMuted">
              VITTRINGSZON (UPPSKATTNING)
            </Txt>
            <Segment
              etikett="Vittringszon"
              val={[
                { varde: "pa", titel: "Visa zon" },
                { varde: "av", titel: "Dölj zon" },
              ]}
              varde={p.zonPa ? "pa" : "av"}
              onChange={(v) => p.setZonPa(v === "pa")}
            />
            {p.zonPa && (
              <>
                <Txt variant="caption" farg="inkMuted">
                  LÄNGD
                </Txt>
                <View style={styles.chips}>
                  {LANGDVAL.map((l) => (
                    <ValChip
                      key={String(l.varde)}
                      titel={l.titel}
                      vald={p.langd === l.varde}
                      onPress={() => p.setLangd(l.varde)}
                      hojd={48}
                    />
                  ))}
                </View>
                <Txt variant="caption" farg="inkMuted">
                  BREDD
                </Txt>
                <View style={styles.chips}>
                  {BREDDVAL.map((b) => (
                    <ValChip
                      key={b.varde}
                      titel={b.titel}
                      vald={p.bredd === b.varde}
                      onPress={() => p.setBredd(b.varde)}
                      hojd={48}
                    />
                  ))}
                </View>
                {p.zon && (
                  <Txt variant="caption" farg="inkMuted">
                    {`Zonen pekar dit vinden blåser, ${Math.round(p.zon.langdMeter)} m${
                      p.langd === "auto" ? " (efter vindstyrkan)" : ""
                    }. Osäkerhet: ${
                      p.zon.niva === "lag" ? "låg" : p.zon.niva === "medel" ? "medel" : "hög"
                    } (±${Math.round(p.zon.spridningGrader)}°), bredare vid byig, svag eller vridande vind.`}
                  </Txt>
                )}
                {p.zon?.svagVind && <VarningsChip text="Svag vind – vittringen kan gå åt alla håll" />}
                <Txt variant="caption" farg="inkMuted">
                  Zonen är en uppskattning, ingen exakt gräns. Terräng, skog, öppna ytor, lokala vindar
                  och termik ingår inte.
                </Txt>
              </>
            )}
          </View>

          {/* Källa och aktualitet */}
          <View style={styles.block}>
            <Txt variant="caption" farg="inkMuted">
              KÄLLA
            </Txt>
            {p.prognos ? (
              <>
                <Txt variant="caption">
                  {p.prognos.attribution}. Prognos{p.steg ? ` för ${dagEtikett(p.steg.tid, p.nu)} ${klocka(p.steg.tid)}` : ""}.
                </Txt>
                <Txt variant="caption" farg="inkMuted">
                  {[
                    p.prognos.referensTid !== null
                      ? `Modellkörning ${dagEtikett(p.prognos.referensTid, p.nu)} ${klocka(p.prognos.referensTid)}`
                      : null,
                    p.prognos.publiceradTid !== null
                      ? `uppdaterad ${klocka(p.prognos.publiceradTid)}`
                      : null,
                    `hämtad ${sedan(p.prognos.hamtadAt, p.nu)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Txt>
                <Txt variant="caption" farg="inkMuted">
                  Pilarna visar prognosen i SMHI:s beräkningsrutor (ca 2,5 km). Variationer inom
                  jaktmarken syns inte.
                </Txt>
              </>
            ) : (
              <Txt variant="caption" farg="inkMuted">
                Ingen prognos hämtad.
              </Txt>
            )}
            {p.franMinne && <VarningsChip text="Ingen täckning – visar senast sparade prognos" />}
            {status === "gammal" && <VarningsChip text="Prognosen är mer än 3 timmar gammal" />}
            {p.fel && !p.laddar && (
              <Knapp variant="sekundar" titel="Hämta igen" onPress={p.onForsokIgen} />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Varde({ etikett, varde }: { etikett: string; varde: string }) {
  return (
    <View style={styles.varde}>
      <Txt variant="caption" farg="inkMuted">
        {etikett}
      </Txt>
      <Txt variant="title2">
        {varde}
      </Txt>
    </View>
  );
}

/** Horisontellt reglage med hela timmar. Valt chip scrollas in i bild. */
function Tidsreglage({
  tider,
  vald,
  onVal,
  nu,
}: {
  tider: number[];
  vald: number | null;
  onVal: (t: number) => void;
  nu: number;
}) {
  const { farger } = useTema();
  const scroll = useRef<ScrollView>(null);
  const index = vald === null ? -1 : tider.indexOf(vald);
  const CHIP = 64;
  useEffect(() => {
    if (index >= 0) {
      scroll.current?.scrollTo({ x: Math.max(0, index * (CHIP + avstand.s2) - CHIP * 1.5), animated: true });
    }
  }, [index]);
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tider}
      accessibilityLabel="Prognostid"
    >
      {tider.map((t, i) => {
        const valt = t === vald;
        const nyDag = i === 0 || new Date(t * 1000).getDate() !== new Date(tider[i - 1] * 1000).getDate();
        const nuTimme = Math.abs(t - nu) < 1800;
        return (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: valt }}
            accessibilityLabel={`${dagEtikett(t, nu)} klockan ${klocka(t)}`}
            onPress={() => onVal(t)}
            style={[
              styles.tid,
              {
                width: CHIP,
                backgroundColor: valt ? farger.brandSoft : farger.surface300,
                borderColor: valt ? farger.brand : "transparent",
              },
            ]}
          >
            <Txt variant="caption" farg={valt ? "brand" : "inkMuted"} numberOfLines={1}>
              {nuTimme ? "nu" : nyDag ? dagEtikett(t, nu) : " "}
            </Txt>
            <Txt variant="bodyStrong" farg={valt ? "brand" : "ink"} style={styles.siffror}>
              {klocka(t).slice(0, 2)}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radie.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: avstand.s2,
    overflow: "hidden",
  },
  huvud: {
    flexDirection: "row",
    alignItems: "center",
    gap: avstand.s3,
    paddingHorizontal: avstand.s4,
    paddingTop: avstand.s3,
    paddingBottom: avstand.s2,
    minHeight: tryck.min,
  },
  flex1: { flex: 1 },
  siffror: { fontVariant: ["tabular-nums"] },
  tider: { gap: avstand.s2, paddingHorizontal: avstand.s4, paddingBottom: avstand.s1 },
  tid: {
    minHeight: tryck.min,
    borderRadius: radie.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  innehall: { paddingHorizontal: avstand.s4, paddingTop: avstand.s3, gap: avstand.s4, paddingBottom: avstand.s3 },
  block: { gap: avstand.s2 },
  varden: { flexDirection: "row", gap: avstand.s4 },
  varde: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: avstand.s2 },
});
